import type { Claim } from "../domain/claim";
import type {
  ContentRelation,
  ContentRelationParticipant,
} from "../domain/contentRelation";
import type { EditorialProjectionBundle } from "../domain/editorialProjection";
import type { Source } from "../domain/source";
import type { StyleObservation } from "../domain/styleObservation";
import type { TransformationTrace } from "../domain/transformationTrace";
import type {
  DemoObservationDefinition,
  DemoParagraphDefinition,
  DemoRelationDefinition,
  FullPipelineDemoDefinition,
} from "./pipelineDemoTypes";
import { required } from "./pipelineDemoUtils";
import {
  CallbackStructuredClient,
  ScriptedStructuredClient,
} from "./scriptedClient";

export function buildObservationClient(
  observation: DemoObservationDefinition
): ScriptedStructuredClient {
  return new ScriptedStructuredClient([
    {
      label: "observation-analysis",
      match: "Tu analyses un passage comme une relation entre matière et écriture.",
      respond: buildObservationResponse(observation),
    },
  ]);
}

function buildObservationResponse(
  observation: DemoObservationDefinition
): unknown {
  return {
    observations: [
      {
        contentConfiguration: {
          argumentativeFunction: observation.argumentativeFunction,
          claimTypes: observation.claimTypes ?? [],
          sourceRegimes: observation.sourceRegimes ?? [],
          relations: observation.relations ?? [],
          tensions: observation.tensions ?? [],
          concepts: observation.concepts ?? [],
        },
        formalOperations: [observation.operation],
        observedEffects: observation.effects,
        evidence: {
          excerpt: observation.excerpt,
        },
        confidence: observation.confidence ?? "high",
        maturity: "single_observation",
        notes: observation.notes ?? [],
      },
    ],
  };
}

export function buildRelationClient(
  definition: FullPipelineDemoDefinition,
  participantCatalog: Map<ContentRelationParticipant["kind"], Map<string, string>>
): CallbackStructuredClient | undefined {
  if (!definition.additionalRelation) {
    return undefined;
  }

  return new CallbackStructuredClient(() => ({
    relations: [
      materializeRelation(definition.additionalRelation!, participantCatalog),
    ],
  }));
}

function materializeRelation(
  relation: DemoRelationDefinition,
  catalog: Map<ContentRelationParticipant["kind"], Map<string, string>>
): unknown {
  const resolve = (
    kind: ContentRelationParticipant["kind"],
    key: string
  ): string =>
    required(catalog.get(kind)?.get(key), `Unknown ${kind} relation key ${key}`);

  return {
    type: relation.type,
    participants: relation.participants.map((participant) => ({
      kind: participant.kind,
      id: resolve(participant.kind, participant.key),
      role: participant.role,
    })),
    description: relation.description,
    evidenceIds: relation.evidence.map((evidence) =>
      resolve(evidence.kind, evidence.key)
    ),
    confidence: relation.confidence ?? "high",
  };
}

export function buildArticulationClient(
  definition: FullPipelineDemoDefinition,
  selectedRelation: ContentRelation,
  observations: StyleObservation[]
): CallbackStructuredClient {
  return new CallbackStructuredClient(() => ({
    candidates: [
      {
        contentRelationIds: [selectedRelation.id],
        supportingObservationIds: observations.map(
          (observation) => observation.id
        ),
        stylisticOperations: [definition.articulation.operation],
        intendedEffects: definition.articulation.effects,
        support: {
          level: observations.length > 0 ? "moderate" : "weak",
          rationale:
            observations.length > 0
              ? "Une opération analogue est localisée dans le corpus de référence."
              : "La proposition repose uniquement sur la fonction éditoriale du projet.",
        },
        risks: definition.articulation.risks ?? [],
        alternatives: [],
      },
    ],
  }));
}

export function buildParagraphClient(
  definition: FullPipelineDemoDefinition,
  paragraphProjections: EditorialProjectionBundle[],
  sourceByKey: Map<string, Source>,
  claimByKey: Map<string, Claim>
): ScriptedStructuredClient {
  return new ScriptedStructuredClient(
    definition.paragraphs.map((paragraph, index) => ({
      label: `paragraph-${index + 1}`,
      match: "Tu travailles en mode PARAGRAPHE.",
      respond: buildParagraphResponse(
        paragraph,
        paragraphProjections[index].writer,
        sourceByKey,
        claimByKey
      ),
    }))
  );
}

function buildParagraphResponse(
  paragraph: DemoParagraphDefinition,
  projection: EditorialProjectionBundle["writer"],
  sourceByKey: Map<string, Source>,
  claimByKey: Map<string, Claim>
): unknown {
  const directive = required(
    projection.directives.find(
      (candidate) => candidate.kind === "form" || candidate.kind === "content"
    ),
    `No traceable directive for paragraph ${paragraph.paragraphId}`
  );

  return {
    plan_3_sentences: [paragraph.argumentativeFunction],
    paragraph: paragraph.content,
    claims: paragraph.claimKeys.map((key) => {
      const claim = required(claimByKey.get(key), `Unknown claim ${key}`);
      return {
        statement: claim.statement,
        confidenceLevel: claim.confidenceLevel,
        sourceIds: paragraph.sourceKeys.map(
          (sourceKey) =>
            required(sourceByKey.get(sourceKey), `Unknown source ${sourceKey}`).id
        ),
      };
    }),
    confidence_assessment: "high",
    applied_directives: [
      {
        directiveId: directive.id,
        decisionId: directive.decisionId,
        articulationId: directive.articulationId,
        declaration: paragraph.traceDeclaration,
        excerpt: paragraph.traceExcerpt,
      },
    ],
  };
}

export function buildEvaluationClient(
  definition: FullPipelineDemoDefinition,
  projections: EditorialProjectionBundle,
  sectionTraces: TransformationTrace[]
): ScriptedStructuredClient {
  return new ScriptedStructuredClient([
    {
      label: "documentary-evaluation",
      match: "Tu es un évaluateur critique d'essais académiques.",
      respond: buildEssayEvaluationResponse(definition),
    },
    {
      label: "editorial-effect-evaluation",
      match: "Tu es le juge éditorial indépendant d'Auto Essay.",
      respond: buildEditorialEvaluationResponse(
        definition,
        projections,
        sectionTraces
      ),
    },
  ]);
}

function buildEssayEvaluationResponse(
  definition: FullPipelineDemoDefinition
): unknown {
  return {
    overallScore: definition.essayAssessment.overallScore,
    dimensions: definition.essayAssessment.dimensions,
    weaknesses: definition.essayAssessment.weaknesses ?? [],
    strongClaims: definition.claims.map((claim) => claim.statement),
    weakClaims: [],
    aiPatternsDetected: [],
    overclaimRisks: [],
    top3Revisions: definition.essayAssessment.top3Revisions ?? [],
    newClaimEntries: [],
    evidenceGaps: [],
    citationGaps: [],
    verdict: definition.essayAssessment.verdict,
  };
}

function buildEditorialEvaluationResponse(
  definition: FullPipelineDemoDefinition,
  projections: EditorialProjectionBundle,
  traces: TransformationTrace[]
): unknown {
  const assessment = definition.editorialAssessment;

  return {
    criterionResults: projections.evaluator.criteria.map((criterion) => ({
      criterionId: criterion.id,
      decisionId: criterion.decisionId,
      articulationId: criterion.articulationId,
      directiveIds: criterion.directiveIds,
      traceIds: traces
        .filter(
          (trace) =>
            trace.decisionId === criterion.decisionId &&
            criterion.directiveIds.includes(trace.directiveId)
        )
        .map((trace) => trace.id),
      status: assessment.status,
      contentScore: assessment.contentScore,
      formScore: assessment.formScore,
      contentFindings: assessment.contentFindings,
      formFindings: assessment.formFindings,
      evidence: assessment.evidenceExcerpt
        ? [{ excerpt: assessment.evidenceExcerpt }]
        : [],
      unintendedEffects: assessment.unintendedEffects ?? [],
      suggestedRepair:
        assessment.status === "effective"
          ? undefined
          : assessment.suggestedRepair ??
            "Réappliquer l'opération au passage ciblé sans modifier les claims.",
    })),
    contentFormCoherence: assessment.contentFormCoherence,
    overallEditorialScore: assessment.overallEditorialScore,
    summary: assessment.summary,
  };
}
