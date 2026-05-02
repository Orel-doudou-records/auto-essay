import { z } from "zod";

/**
 * Dimensions d'évaluation d'un essai
 * Inspiré d'autonovel mais adapté à l'argumentation
 */
export const EvaluationDimensionSchema = z.enum([
  "claimSupport",           // Preuves suffisantes ?
  "citationIntegrity",      // Citations correctes ?
  "counterargumentQuality", // Objections traitées ?
  "transitionClarity",      // Enchaînements logiques ?
  "scopeControl",           // Pas de sur-généralisation ?
  "voiceConsistency",       // Ton maintenu ?
]);

export type EvaluationDimension = z.infer<typeof EvaluationDimensionSchema>;

/**
 * Évaluation d'une faiblesse
 */
export const WeaknessSchema = z.object({
  dimension: EvaluationDimensionSchema,
  description: z.string(),
  severity: z.enum(["critical", "major", "minor"]),
  location: z.string().optional(), // Référence dans le texte
  suggestedFix: z.string().optional(),
});

export type Weakness = z.infer<typeof WeaknessSchema>;

/**
 * Risque de sur-assertion
 */
export const OverclaimRiskSchema = z.object({
  claim: z.string(),
  location: z.string(),
  issue: z.enum([
    "unsupported_generalization",
    "causal_overreach",
    "unverified_certainty",
    "missing_citation",
    "extrapolation_beyond_evidence",
  ]),
  severity: z.enum(["critical", "major", "minor"]),
  suggestion: z.string(),
});

export type OverclaimRisk = z.infer<typeof OverclaimRiskSchema>;

/**
 * Gap de preuve
 */
export const EvidenceGapSchema = z.object({
  claim: z.string(),
  location: z.string(),
  missingEvidence: z.string(),
  priority: z.enum(["high", "medium", "low"]),
});

export type EvidenceGap = z.infer<typeof EvidenceGapSchema>;

/**
 * Gap de citation
 */
export const CitationGapSchema = z.object({
  statement: z.string(),
  location: z.string(),
  expectedSource: z.string().optional(),
  priority: z.enum(["high", "medium", "low"]),
});

export type CitationGap = z.infer<typeof CitationGapSchema>;

/**
 * Suggestion de révision
 */
export const RevisionSuggestionSchema = z.object({
  priority: z.number().int().min(1).max(3),
  target: z.string(), // Quoi réviser
  issue: z.string(),  // Quel est le problème
  approach: z.string(), // Comment réviser
});

export type RevisionSuggestion = z.infer<typeof RevisionSuggestionSchema>;

/**
 * Résultat d'évaluation complet - READ-ONLY harness
 * Inspiré d'autonovel/evaluate.py
 */
export const EssayEvaluationSchema = z.object({
  /** Score global (0-10) */
  overallScore: z.number().min(0).max(10),

  /** Scores par dimension */
  dimensions: z.object({
    claimSupport: z.number().min(0).max(10),
    citationIntegrity: z.number().min(0).max(10),
    counterargumentQuality: z.number().min(0).max(10),
    transitionClarity: z.number().min(0).max(10),
    scopeControl: z.number().min(0).max(10),
    voiceConsistency: z.number().min(0).max(10),
  }),

  /** Faiblesses identifiées */
  weaknesses: z.array(WeaknessSchema),

  /** Assertions fortes (à préserver) */
  strongClaims: z.array(z.string()),

  /** Assertions faibles (à renforcer) */
  weakClaims: z.array(z.string()),

  /** Patterns IA détectés */
  aiPatternsDetected: z.array(z.string()),

  /** Risques de sur-assertion */
  overclaimRisks: z.array(OverclaimRiskSchema),

  /** Top 3 suggestions de révision */
  top3Revisions: z.array(RevisionSuggestionSchema).max(3),

  /** Nouvelles assertions à ajouter au ledger */
  newClaimEntries: z.array(z.object({
    statement: z.string(),
    sourceIds: z.array(z.string()),
    confidenceLevel: z.enum(["certain", "probable", "speculative", "unsupported"]),
  })),

  /** Gaps de preuve */
  evidenceGaps: z.array(EvidenceGapSchema),

  /** Gaps de citation */
  citationGaps: z.array(CitationGapSchema),

  /** Verdict global */
  verdict: z.enum([
    "keep",       // Garder tel quel
    "keep_with_minor_edits", // Garder avec éditions mineures
    "revise",     // Nécessite révision
    "discard",    // Rejeter et réécrire
  ]),

  /** Date de l'évaluation */
  evaluatedAt: z.string().datetime(),

  /** Modèle utilisé pour l'évaluation */
  evaluatorModel: z.string(),
});

export type EssayEvaluation = z.infer<typeof EssayEvaluationSchema>;

/**
 * Crée une évaluation vide (pour initialisation)
 */
export function createEmptyEvaluation(modelName: string): EssayEvaluation {
  const now = new Date().toISOString();
  return {
    overallScore: 0,
    dimensions: {
      claimSupport: 0,
      citationIntegrity: 0,
      counterargumentQuality: 0,
      transitionClarity: 0,
      scopeControl: 0,
      voiceConsistency: 0,
    },
    weaknesses: [],
    strongClaims: [],
    weakClaims: [],
    aiPatternsDetected: [],
    overclaimRisks: [],
    top3Revisions: [],
    newClaimEntries: [],
    evidenceGaps: [],
    citationGaps: [],
    verdict: "revise",
    evaluatedAt: now,
    evaluatorModel: modelName,
  };
}

/**
 * Seuils de qualité (inspirés d'autonovel)
 */
export const QUALITY_THRESHOLDS = {
  /** Score minimum pour garder une unité (6.0 comme autonovel) */
  KEEP_THRESHOLD: 6.0,

  /** Score minimum pour valider la phase de planning (7.5) */
  PLANNING_THRESHOLD: 7.5,

  /** Score pour garder avec éditions mineures */
  MINOR_EDITS_THRESHOLD: 7.0,

  /** Différence minimale pour détecter une amélioration */
  IMPROVEMENT_DELTA: 0.3,
};

/**
 * Vérifie si une évaluation passe le seuil de qualité
 */
export function meetsQualityThreshold(evaluation: EssayEvaluation): boolean {
  return evaluation.overallScore >= QUALITY_THRESHOLDS.KEEP_THRESHOLD;
}

/**
 * Détecte si les scores ont atteint un plateau
 */
export function hasPlateaued(
  current: EssayEvaluation,
  previous: EssayEvaluation
): boolean {
  const delta = Math.abs(current.overallScore - previous.overallScore);
  return delta < QUALITY_THRESHOLDS.IMPROVEMENT_DELTA;
}
