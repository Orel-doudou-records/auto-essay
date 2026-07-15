import type { DraftUnit } from "../domain/draftUnit";
import type { Source } from "../domain/source";
import type { Claim } from "../domain/claim";
import type { EssayVoice } from "../domain/essayProject";
import type { EvaluatorEditorialProjection } from "../domain/editorialProjection";
import type { TransformationTrace } from "../domain/transformationTrace";
import {
  type EssayEvaluation,
  EssayEvaluationSchema,
  createEmptyEvaluation,
  QUALITY_THRESHOLDS,
} from "../domain/evaluation";
import {
  createIntegratedEvaluation,
  type IntegratedEvaluation,
} from "../domain/editorialEffectEvaluation";
import { passesMechanicalChecks } from "./mechanicalChecks";
import { EditorialEffectEvaluator } from "./editorialEffectEvaluator";

/**
 * Interface pour un client de modèle structuré
 * Permet l'injection de dépendance (OpenAI, Anthropic, mock, etc.)
 */
export interface StructuredModelClient {
  /**
   * Génère une réponse JSON structurée à partir d'un prompt
   */
  generateJson(prompt: string): Promise<unknown>;
}

/**
 * Contexte d'évaluation
 */
export interface EvaluationContext {
  unit: DraftUnit;
  sources: Source[];
  claims: Claim[];
  voice?: EssayVoice;
  previousEvaluations?: EssayEvaluation[];
  editorialProjection?: EvaluatorEditorialProjection;
  transformationTraces?: TransformationTrace[];
}

/**
 * Évalueur d'essai - READ-ONLY harness
 * Inspiré d'autonovel/evaluate.py
 *
 * Principe : L'évaluateur est une boîte noire pour l'agent.
 * L'humain peut modifier les critères, l'agent ne peut pas les contourner.
 */
export class EssayEvaluator {
  private client: StructuredModelClient;
  private judgeModel: string;

  constructor(client: StructuredModelClient, judgeModel: string = "judge-model") {
    this.client = client;
    this.judgeModel = judgeModel;
  }

  /**
   * Évalue une unité de rédaction selon les critères argumentatifs historiques.
   */
  async evaluate(context: EvaluationContext): Promise<EssayEvaluation> {
    validateEditorialContext(context);

    // Étape 1: Vérifications mécaniques (sans LLM)
    const mechanicalResult = passesMechanicalChecks(
      context.unit.content,
      0, // 0 erreur tolérée
      10 // 10 warnings max
    );

    // Si échec mécanique critique, retourner une évaluation négative
    const criticalIssues = mechanicalResult.issues.filter(
      (i) => i.severity === "error"
    );

    if (criticalIssues.length > 0) {
      const emptyEval = createEmptyEvaluation(this.judgeModel);
      return EssayEvaluationSchema.parse({
        ...emptyEval,
        overallScore: 3.0,
        verdict: "revise",
        weaknesses: criticalIssues.map((i) => ({
          dimension: "citationIntegrity",
          description: i.message,
          severity: "critical",
          location: i.location,
          suggestedFix: i.suggestion,
        })),
      });
    }

    // Étape 2: Évaluation LLM (judge model)
    const prompt = this.buildEvaluationPrompt(context);
    const rawOutput = await this.client.generateJson(prompt);

    // Étape 3: Parser et valider
    const evaluation = this.parseEvaluation(rawOutput as Record<string, unknown>);

    // Étape 4: Fusionner avec issues mécaniques
    return EssayEvaluationSchema.parse({
      ...evaluation,
      weaknesses: [
        ...evaluation.weaknesses,
        ...mechanicalResult.issues.map((i) => ({
          dimension: "citationIntegrity" as const,
          description: i.message,
          severity: (i.severity === "warning" ? "major" : "minor") as
            | "major"
            | "minor",
          location: i.location,
          suggestedFix: i.suggestion,
        })),
      ],
    });
  }

  /**
   * Exécute les deux jugements puis applique des portes indépendantes.
   * Une réussite éditoriale ne peut jamais compenser un échec documentaire.
   */
  async evaluateIntegrated(
    context: EvaluationContext
  ): Promise<IntegratedEvaluation> {
    const essay = await this.evaluate(context);

    if (!context.editorialProjection) {
      return createIntegratedEvaluation(essay);
    }

    const editorial = await new EditorialEffectEvaluator(
      this.client,
      `${this.judgeModel}:editorial`
    ).evaluate({
      unit: context.unit,
      projection: context.editorialProjection,
      transformationTraces: context.transformationTraces,
    });

    return createIntegratedEvaluation(essay, editorial);
  }

  /**
   * Construit le prompt d'évaluation
   */
  private buildEvaluationPrompt(context: EvaluationContext): string {
    const {
      unit,
      sources,
      claims,
      voice,
      editorialProjection,
      transformationTraces = [],
    } = context;

    const evidencePack = unit.evidencePack;
    const sourceList = sources
      .filter((s) => evidencePack.sourceIds.includes(s.id))
      .map((s) => `- ${s.title} (${s.authors.join(", ")})`)
      .join("\n");

    const claimList = claims
      .filter((c) => unit.claimIds.includes(c.id))
      .map((c) => `- [${c.confidenceLevel}] ${c.statement}`)
      .join("\n");

    const editorialContext = editorialProjection
      ? `## Contexte éditorial canonique
Cette projection provient d'un plan validé. Elle sert de contexte critique, mais ses effets sont évalués séparément par le juge éditorial.

\`\`\`json
${JSON.stringify(
  {
    projectionId: editorialProjection.id,
    planId: editorialProjection.planId,
    criteria: editorialProjection.criteria,
    intendedEffects: editorialProjection.intendedEffects,
  },
  null,
  2
)}
\`\`\`

## Déclarations du writer
Ces traces sont des déclarations à vérifier, jamais une preuve de réussite.

\`\`\`json
${JSON.stringify(
  transformationTraces.map((trace) => ({
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
`
      : "";

    return `Tu es un évaluateur critique d'essais académiques. Évalue cette unité de rédaction selon les critères ci-dessous.

## Unité à évaluer
Granularité: ${unit.granularity}
Thèse: ${unit.thesis || "Non spécifiée"}
Objectif de mots: ${unit.targetWordCount}
${voice ? `Voix attendue: ${voice.tone}, densité ${voice.density}` : ""}

## Contenu
\`\`\`
${unit.content}
\`\`\`

## Sources utilisées
${sourceList || "Aucune source spécifiée"}

## Assertions attendues
${claimList || "Aucune assertion tracée"}

${editorialContext}
## Instructions d'évaluation

1. **claimSupport** (0-10): Les preuves soutiennent-elles les assertions ?
2. **citationIntegrity** (0-10): Les citations sont-elles correctes et présentes ?
3. **counterargumentQuality** (0-10): Les objections sont-elles traitées ?
4. **transitionClarity** (0-10): Les enchaînements sont-ils logiques ?
5. **scopeControl** (0-10): Y a-t-il des sur-généralisations ?
6. **voiceConsistency** (0-10): Le ton est-il maintenu ?

Ne relève jamais un score documentaire parce qu'un effet formel semble réussi. Les claims, preuves, citations et limites de portée restent prioritaires.

## Format de sortie (JSON strict)
\`\`\`json
{
  "overallScore": number,
  "dimensions": {
    "claimSupport": number,
    "citationIntegrity": number,
    "counterargumentQuality": number,
    "transitionClarity": number,
    "scopeControl": number,
    "voiceConsistency": number
  },
  "weaknesses": [
    {
      "dimension": "claimSupport|citationIntegrity|counterargumentQuality|transitionClarity|scopeControl|voiceConsistency",
      "description": "string",
      "severity": "critical|major|minor",
      "location": "string",
      "suggestedFix": "string"
    }
  ],
  "strongClaims": ["string"],
  "weakClaims": ["string"],
  "aiPatternsDetected": ["string"],
  "overclaimRisks": [
    {
      "claim": "string",
      "location": "string",
      "issue": "unsupported_generalization|causal_overreach|unverified_certainty|missing_citation|extrapolation_beyond_evidence",
      "severity": "critical|major|minor",
      "suggestion": "string"
    }
  ],
  "top3Revisions": [
    {
      "priority": 1,
      "target": "string",
      "issue": "string",
      "approach": "string"
    }
  ],
  "newClaimEntries": [
    {
      "statement": "string",
      "sourceIds": ["string"],
      "confidenceLevel": "certain|probable|speculative|unsupported"
    }
  ],
  "evidenceGaps": [
    {
      "claim": "string",
      "location": "string",
      "missingEvidence": "string",
      "priority": "high|medium|low"
    }
  ],
  "citationGaps": [
    {
      "statement": "string",
      "location": "string",
      "expectedSource": "string",
      "priority": "high|medium|low"
    }
  ],
  "verdict": "keep|keep_with_minor_edits|revise|discard"
}
\`\`\`

Évalue de manière critique et précise. Ne sois pas indulgent.`;
  }

  /**
   * Parse la réponse d'évaluation
   */
  private parseEvaluation(rawOutput: Record<string, unknown>): EssayEvaluation {
    const dimensions = rawOutput.dimensions as Record<string, number>;

    return EssayEvaluationSchema.parse({
      overallScore: Number(rawOutput.overallScore) || 0,
      dimensions: {
        claimSupport: dimensions?.claimSupport || 0,
        citationIntegrity: dimensions?.citationIntegrity || 0,
        counterargumentQuality: dimensions?.counterargumentQuality || 0,
        transitionClarity: dimensions?.transitionClarity || 0,
        scopeControl: dimensions?.scopeControl || 0,
        voiceConsistency: dimensions?.voiceConsistency || 0,
      },
      weaknesses: rawOutput.weaknesses || [],
      strongClaims: rawOutput.strongClaims || [],
      weakClaims: rawOutput.weakClaims || [],
      aiPatternsDetected: rawOutput.aiPatternsDetected || [],
      overclaimRisks: rawOutput.overclaimRisks || [],
      top3Revisions: rawOutput.top3Revisions || [],
      newClaimEntries: rawOutput.newClaimEntries || [],
      evidenceGaps: rawOutput.evidenceGaps || [],
      citationGaps: rawOutput.citationGaps || [],
      verdict: rawOutput.verdict || "revise",
      evaluatedAt: new Date().toISOString(),
      evaluatorModel: this.judgeModel,
    });
  }

  /**
   * Compare deux évaluations pour détecter un plateau
   */
  hasPlateaued(current: EssayEvaluation, previous: EssayEvaluation): boolean {
    const delta = Math.abs(current.overallScore - previous.overallScore);
    return delta < QUALITY_THRESHOLDS.IMPROVEMENT_DELTA;
  }
}

/**
 * Factory pour créer un évaluateur
 */
export function createEssayEvaluator(
  client: StructuredModelClient,
  judgeModel?: string
): EssayEvaluator {
  return new EssayEvaluator(client, judgeModel);
}

function validateEditorialContext(context: EvaluationContext): void {
  if (!context.editorialProjection) {
    if ((context.transformationTraces ?? []).length > 0) {
      throw new Error(
        "Transformation traces require an evaluator editorial projection"
      );
    }
    return;
  }

  if (
    context.editorialProjection.unitId !== context.unit.id ||
    context.editorialProjection.unitVersion !== context.unit.version
  ) {
    throw new Error("Evaluator projection does not match the evaluated unit");
  }

  if (
    context.unit.editorialPlanId !== undefined &&
    context.unit.editorialPlanId !== context.editorialProjection.planId
  ) {
    throw new Error("Evaluator projection plan does not match the unit plan");
  }
}
