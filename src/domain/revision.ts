import { z } from "zod";

/**
 * Zone de focus pour une révision
 */
export const FocusAreaSchema = z.object({
  dimension: z.enum([
    "claimSupport",
    "citationIntegrity",
    "counterargumentQuality",
    "transitionClarity",
    "scopeControl",
    "voiceConsistency",
  ]),
  priority: z.number().int().min(1).max(3),
  description: z.string(),
});

export type FocusArea = z.infer<typeof FocusAreaSchema>;

export const RelationalRevisionInstructionSchema = z.object({
  priority: z.number().int().min(1).max(3),
  criterionId: z.string().min(1),
  decisionId: z.string().min(1),
  articulationId: z.string().min(1),
  directiveIds: z.array(z.string().min(1)).min(1),
  issue: z.string().min(1),
  instruction: z.string().min(1),
  targetExcerpt: z.string().min(1).optional(),
  preserve: z.array(z.string().min(1)).default([]),
  avoid: z.array(z.string().min(1)).default([]),
  protectedClaimIds: z.array(z.string().min(1)).default([]),
});

export type RelationalRevisionInstruction = z.infer<
  typeof RelationalRevisionInstructionSchema
>;

/**
 * Brief de révision - Instructions pour améliorer une unité
 * Auto-généré à partir de l'évaluation
 */
export const RevisionBriefSchema = z.object({
  /** Identifiant unique */
  id: z.string(),

  /** Unité cible */
  targetUnitId: z.string(),

  /** Évaluation source */
  sourceEvaluationId: z.string(),

  /** Évaluation éditoriale source, si présente */
  sourceEditorialEvaluationId: z.string().min(1).optional(),

  /** Projection de révision canonique utilisée */
  editorialProjectionId: z.string().min(1).optional(),

  /** Zones de focus prioritaires */
  focusAreas: z.array(FocusAreaSchema).max(3),

  /** Instructions spécifiques */
  specificInstructions: z.array(z.string()),

  /** Réparations relationnelles traçables */
  relationalInstructions: z
    .array(RelationalRevisionInstructionSchema)
    .default([]),

  /** Invariants éditoriaux à préserver */
  preserveInvariants: z.array(z.string().min(1)).default([]),

  /** Changements ou raccourcis interdits */
  prohibitedChanges: z.array(z.string().min(1)).default([]),

  /** Claims protégés contre une modification silencieuse */
  protectedClaimIds: z.array(z.string().min(1)).default([]),

  /** Preuves à ajouter */
  evidenceToAdd: z.array(z.object({
    claim: z.string(),
    suggestedSources: z.array(z.string()).optional(),
    priority: z.enum(["high", "medium", "low"]),
  })),

  /** Assertions à renforcer */
  claimsToStrengthen: z.array(z.object({
    claim: z.string(),
    currentIssue: z.string(),
    suggestion: z.string(),
  })),

  /** Sur-assertions à corriger */
  overclaimsToFix: z.array(z.object({
    location: z.string(),
    current: z.string(),
    issue: z.string(),
    suggestion: z.string(),
  })),

  /** Citations manquantes à ajouter */
  citationsToAdd: z.array(z.object({
    statement: z.string(),
    sourceId: z.string().optional(),
    priority: z.enum(["high", "medium", "low"]),
  })),

  /** Objections à traiter */
  objectionsToAddress: z.array(z.object({
    objection: z.string(),
    suggestedResponse: z.string().optional(),
  })),

  /** Date de création */
  createdAt: z.string().datetime(),

  /** Appliqué ? */
  appliedAt: z.string().datetime().optional(),

  /** Résultat après application */
  resultScore: z.number().min(0).max(10).optional(),
});

export type RevisionBrief = z.infer<typeof RevisionBriefSchema>;

/**
 * Crée un brief de révision à partir d'une évaluation
 */
export function createRevisionBrief(
  targetUnitId: string,
  sourceEvaluationId: string,
  focusAreas: FocusArea[],
  specificInstructions: string[]
): RevisionBrief {
  return RevisionBriefSchema.parse({
    id: crypto.randomUUID(),
    targetUnitId,
    sourceEvaluationId,
    focusAreas: focusAreas.slice(0, 3),
    specificInstructions,
    relationalInstructions: [],
    preserveInvariants: [],
    prohibitedChanges: [],
    protectedClaimIds: [],
    evidenceToAdd: [],
    claimsToStrengthen: [],
    overclaimsToFix: [],
    citationsToAdd: [],
    objectionsToAddress: [],
    createdAt: new Date().toISOString(),
  });
}

/**
 * Provenance éditoriale persistée avec une version publiée.
 */
export const EditorialManifestProvenanceSchema = z.object({
  planId: z.string().min(1),
  decisions: z.array(z.object({
    decisionId: z.string().min(1),
    version: z.number().int().positive(),
  })).min(1),
  articulationIds: z.array(z.string().min(1)).min(1),
  projectionIds: z.object({
    writer: z.string().min(1),
    evaluator: z.string().min(1),
    revision: z.string().min(1),
  }),
  projectionHashes: z.object({
    writer: z.string().min(1),
    evaluator: z.string().min(1),
    revision: z.string().min(1),
  }),
  transformationTraceIds: z.array(z.string().min(1)).default([]),
  editorialEffectEvaluationId: z.string().min(1).optional(),
  revisionBriefId: z.string().min(1).optional(),
});

export type EditorialManifestProvenance = z.infer<
  typeof EditorialManifestProvenanceSchema
>;

/**
 * Manifest de livraison - Trace de ce qui est publié
 * Inspiré d'OpenClaw
 */
export const DeliveryManifestSchema = z.object({
  /** Version publiée */
  version: z.number().int().positive(),

  /** Date de publication */
  publishedAt: z.string().datetime(),

  /** Unités incluses */
  units: z.array(z.object({
    unitId: z.string(),
    version: z.number().int().positive(),
    score: z.number().min(0).max(10),
  })),

  /** Sources utilisées */
  sourcesUsed: z.array(z.string()),

  /** Assertions validées */
  verifiedClaims: z.array(z.string()),

  /** Dettes restantes */
  remainingDebts: z.array(z.string()),

  /** Exports générés */
  exports: z.object({
    markdown: z.string().optional(),
    pdf: z.string().optional(),
    bibtex: z.string().optional(),
    packageZip: z.string().optional(),
  }),

  /** Hash git (si applicable) */
  gitCommit: z.string().optional(),

  /** Provenance Literacraft, absente des anciennes publications */
  editorialProvenance: EditorialManifestProvenanceSchema.optional(),
});

export type DeliveryManifest = z.infer<typeof DeliveryManifestSchema>;
