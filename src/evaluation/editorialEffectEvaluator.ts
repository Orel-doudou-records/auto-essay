import { z } from "zod";
import type { DraftUnit } from "../domain/draftUnit";
import {
  EditorialCriterionResultSchema,
  EditorialEffectEvaluationSchema,
  type EditorialCriterionResult,
  type EditorialEffectEvaluation,
} from "../domain/editorialEffectEvaluation";
import type { EvaluatorEditorialProjection } from "../domain/editorialProjection";
import type { TransformationTrace } from "../domain/transformationTrace";
import { sameStringSet } from "../utils/array";
import type { StructuredModelClient } from "./evaluateEssay";

const RawEditorialEffectEvaluationSchema = z.object({
  criterionResults: z.array(EditorialCriterionResultSchema).min(1),
  contentFormCoherence: z.number().min(0).max(10),
  overallEditorialScore: z.number().min(0).max(10),
  summary: z.string().min(1),
});

export interface EditorialEffectEvaluationContext {
  unit: DraftUnit;
  projection: EvaluatorEditorialProjection;
  transformationTraces?: TransformationTrace[];
}

/**
 * Évalue les effets réels d'une projection éditoriale.
 * Les traces du writer sont des déclarations à vérifier, jamais des preuves.
 */
export class EditorialEffectEvaluator {
  constructor(
    private readonly client: StructuredModelClient,
    private readonly evaluatorModel: string = "editorial-judge-model"
  ) {}

  async evaluate(
    context: EditorialEffectEvaluationContext
  ): Promise<EditorialEffectEvaluation> {
    validateContext(context);

    const rawOutput = await this.client.generateJson(
      buildEditorialEffectPrompt(context)
    );
    const parsed = RawEditorialEffectEvaluationSchema.parse(rawOutput);
    const criterionResults = validateAndNormalizeResults(
      parsed.criterionResults,
      context
    );

    return EditorialEffectEvaluationSchema.parse({
      id: crypto.randomUUID(),
      unitId: context.unit.id,
      unitVersion: context.unit.version,
      projectionId: context.projection.id,
      planId: context.projection.planId,
      criterionResults,
      contentFormCoherence: parsed.contentFormCoherence,
      overallEditorialScore: parsed.overallEditorialScore,
      summary: parsed.summary,
      evaluatedAt: new Date().toISOString(),
      evaluatorModel: this.evaluatorModel,
    });
  }
}

export function createEditorialEffectEvaluator(
  client: StructuredModelClient,
  evaluatorModel?: string
): EditorialEffectEvaluator {
  return new EditorialEffectEvaluator(client, evaluatorModel);
}

export function buildEditorialEffectPrompt(
  context: EditorialEffectEvaluationContext
): string {
  const traces = context.transformationTraces ?? [];

  return `Tu es le juge éditorial indépendant d'Auto Essay.

Tu dois vérifier si les opérations validées ont réellement produit leurs effets dans le texte. Les traces du writer sont uniquement des déclarations d'intention : elles peuvent être exactes, insuffisantes ou fausses.

## Unité
- id: ${context.unit.id}
- version: ${context.unit.version}
- granularité: ${context.unit.granularity}

## Texte
\`\`\`
${context.unit.content}
\`\`\`

## Critères canoniques
\`\`\`json
${JSON.stringify(context.projection.criteria, null, 2)}
\`\`\`

## Effets globaux attendus
\`\`\`json
${JSON.stringify(context.projection.intendedEffects, null, 2)}
\`\`\`

## Déclarations du writer à vérifier
\`\`\`json
${JSON.stringify(
  traces.map((trace) => ({
    id: trace.id,
    directiveId: trace.directiveId,
    decisionId: trace.decisionId,
    articulationId: trace.articulationId,
    declaration: trace.declaration,
    excerpt: trace.location.excerpt,
  })),
  null,
  2
)}
\`\`\`

## Règles
- Retourne exactement un résultat pour chaque critère canonique.
- Recopie exactement criterionId, decisionId, articulationId et directiveIds.
- N'utilise que les traceIds fournis.
- Distingue : absent, présent mais inefficace, partiellement efficace, efficace, nuisible.
- Une opération visible mais décorative est \`present_ineffective\`, pas \`effective\`.
- Évalue séparément le traitement du contenu et la forme.
- Tout statut autre que \`absent\` doit citer au moins un extrait exact du texte.
- Toute évaluation non efficace doit proposer une réparation située.
- Ne relève jamais un score documentaire ou une assertion factuelle : cette évaluation ne juge que les effets éditoriaux.

## Format JSON strict
{
  "criterionResults": [
    {
      "criterionId": "string",
      "decisionId": "string",
      "articulationId": "string",
      "directiveIds": ["string"],
      "traceIds": ["string"],
      "status": "absent|present_ineffective|partially_effective|effective|harmful",
      "contentScore": 0,
      "formScore": 0,
      "contentFindings": ["string"],
      "formFindings": ["string"],
      "evidence": [{ "excerpt": "extrait exact" }],
      "unintendedEffects": ["string"],
      "suggestedRepair": "string si non efficace"
    }
  ],
  "contentFormCoherence": 0,
  "overallEditorialScore": 0,
  "summary": "string"
}`;
}

function validateContext(context: EditorialEffectEvaluationContext): void {
  if (
    context.projection.unitId !== context.unit.id ||
    context.projection.unitVersion !== context.unit.version
  ) {
    throw new Error("Evaluator projection does not match the evaluated unit");
  }

  if (
    context.unit.editorialPlanId !== undefined &&
    context.unit.editorialPlanId !== context.projection.planId
  ) {
    throw new Error("Evaluator projection plan does not match the unit plan");
  }

  const traceIds = new Set<string>();
  for (const trace of context.transformationTraces ?? []) {
    if (traceIds.has(trace.id)) {
      throw new Error(`Duplicate transformation trace ${trace.id}`);
    }
    traceIds.add(trace.id);

    if (
      trace.unitId !== context.unit.id ||
      trace.unitVersion !== context.unit.version
    ) {
      throw new Error(`Transformation trace ${trace.id} belongs to another unit`);
    }

    if (
      context.unit.transformationTraceIds.length > 0 &&
      !context.unit.transformationTraceIds.includes(trace.id)
    ) {
      throw new Error(
        `Transformation trace ${trace.id} is absent from the unit trace catalog`
      );
    }
  }
}

function validateAndNormalizeResults(
  results: EditorialCriterionResult[],
  context: EditorialEffectEvaluationContext
): EditorialCriterionResult[] {
  const criteria = new Map(
    context.projection.criteria.map((criterion) => [criterion.id, criterion])
  );
  const traces = new Map(
    (context.transformationTraces ?? []).map((trace) => [trace.id, trace])
  );
  const seenCriterionIds = new Set<string>();

  const normalized = results.map((result) => {
    const criterion = criteria.get(result.criterionId);
    if (!criterion) {
      throw new Error(
        `Editorial evaluation references unknown criterion ${result.criterionId}`
      );
    }
    if (seenCriterionIds.has(result.criterionId)) {
      throw new Error(
        `Editorial evaluation duplicates criterion ${result.criterionId}`
      );
    }
    seenCriterionIds.add(result.criterionId);

    if (
      result.decisionId !== criterion.decisionId ||
      result.articulationId !== criterion.articulationId
    ) {
      throw new Error(
        `Editorial evaluation provenance does not match criterion ${result.criterionId}`
      );
    }

    if (!sameStringSet(result.directiveIds, criterion.directiveIds)) {
      throw new Error(
        `Editorial evaluation directives do not match criterion ${result.criterionId}`
      );
    }

    for (const traceId of result.traceIds) {
      const trace = traces.get(traceId);
      if (!trace) {
        throw new Error(
          `Editorial evaluation references unknown trace ${traceId}`
        );
      }
      if (
        !criterion.directiveIds.includes(trace.directiveId) ||
        trace.decisionId !== criterion.decisionId ||
        trace.articulationId !== criterion.articulationId
      ) {
        throw new Error(
          `Transformation trace ${traceId} does not belong to criterion ${result.criterionId}`
        );
      }
    }

    const evidence = result.evidence.map((item) => {
      const start = context.unit.content.indexOf(item.excerpt);
      if (start < 0) {
        throw new Error(
          `Editorial evidence excerpt is absent from unit ${context.unit.id}: ${item.excerpt}`
        );
      }
      const end = start + item.excerpt.length;

      if (
        item.start !== undefined &&
        item.end !== undefined &&
        (item.start !== start || item.end !== end)
      ) {
        throw new Error(
          `Editorial evidence offsets do not match excerpt ${item.excerpt}`
        );
      }

      return { excerpt: item.excerpt, start, end };
    });

    return EditorialCriterionResultSchema.parse({
      ...result,
      evidence,
    });
  });

  if (seenCriterionIds.size !== criteria.size) {
    const missing = [...criteria.keys()].filter(
      (criterionId) => !seenCriterionIds.has(criterionId)
    );
    throw new Error(
      `Editorial evaluation is missing criteria: ${missing.join(", ")}`
    );
  }

  return normalized;
}

