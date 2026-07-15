import { z } from "zod";

/**
 * Dimensions stylistiques analysées par Literacraft.
 * Elles décrivent des mécanismes observables, jamais une simple étiquette d'auteur.
 */
export const StyleDimensionSchema = z.enum([
  "narration",
  "structure",
  "syntax",
  "rhythm",
  "tone",
  "lexicon",
  "rhetoric",
  "symbolism",
  "readerRelation",
  "creativeImperfection",
]);

export type StyleDimension = z.infer<typeof StyleDimensionSchema>;

export const PatternStrengthSchema = z.enum([
  "trace",
  "secondary",
  "strong",
  "dominant",
]);

export const PatternAdaptabilitySchema = z.enum([
  "invariant",
  "contextual",
  "transformable",
  "sourceBound",
]);

/**
 * Un pattern stylistique doit être relié à des indices textuels.
 * Cela empêche le profil de devenir un agrégat d'adjectifs vagues.
 */
export const StylePatternSchema = z.object({
  id: z.string(),
  dimension: StyleDimensionSchema,
  mechanism: z.string(),
  effect: z.string(),
  evidence: z.array(z.string()).default([]),
  strength: PatternStrengthSchema,
  adaptability: PatternAdaptabilitySchema,
  imitationRisk: z.enum(["low", "medium", "high"]).default("low"),
});

export type StylePattern = z.infer<typeof StylePatternSchema>;

export const ContentPillarSchema = z.object({
  name: z.string(),
  description: z.string(),
  role: z.enum(["central", "supporting", "counterpoint", "latent"]),
  symbols: z.array(z.string()).default([]),
});

export type ContentPillar = z.infer<typeof ContentPillarSchema>;

/**
 * Sortie structurée de l'analyse Literacraft.
 * Le profil sépare les invariants de voix des éléments liés au texte source.
 */
export const StyleProfileSchema = z.object({
  id: z.string(),
  version: z.literal("1.0"),
  sourceLabel: z.string().optional(),
  authorIntent: z.object({
    primaryAim: z.string(),
    desiredReaderEffect: z.array(z.string()).default([]),
    targetAudience: z.string().optional(),
    explicitConstraints: z.array(z.string()).default([]),
  }),
  summary: z.string(),
  patterns: z.array(StylePatternSchema).default([]),
  contentPillars: z.array(ContentPillarSchema).default([]),
  signature: z.object({
    invariants: z.array(z.string()).default([]),
    variables: z.array(z.string()).default([]),
    productiveTensions: z.array(z.string()).default([]),
    antiPatterns: z.array(z.string()).default([]),
  }),
  ethicalBoundary: z.object({
    preserveMechanismsNotSurface: z.boolean().default(true),
    forbiddenVerbatimReuse: z.boolean().default(true),
    notes: z.array(z.string()).default([]),
  }),
  createdAt: z.string().datetime(),
});

export type StyleProfile = z.infer<typeof StyleProfileSchema>;

export const EntanglementSchema = z.object({
  name: z.string(),
  sourcePatternIds: z.array(z.string()).default([]),
  targetConstraint: z.string(),
  relation: z.string(),
  whatBecomesVisible: z.array(z.string()).default([]),
  whatRisksDisappearing: z.array(z.string()).default([]),
});

export type Entanglement = z.infer<typeof EntanglementSchema>;

/**
 * Une coupe agentielle rend explicite ce que la génération décide de préserver,
 * transformer ou exclure. Ne pas choisir est également une coupe.
 */
export const AgentialCutSchema = z.object({
  id: z.string(),
  entanglement: z.string(),
  preserve: z.array(z.string()).default([]),
  transform: z.array(z.string()).default([]),
  exclude: z.array(z.string()).default([]),
  inclusionEffects: z.array(z.string()).default([]),
  exclusionEffects: z.array(z.string()).default([]),
  rationale: z.string(),
});

export type AgentialCut = z.infer<typeof AgentialCutSchema>;

/**
 * Résultat de la lecture diffractive entre un profil de style et un nouveau
 * contexte essayistique. Ce plan remplace la logique de "copie de style".
 */
export const DiffractiveStylePlanSchema = z.object({
  id: z.string(),
  version: z.literal("1.0"),
  profileId: z.string(),
  target: z.object({
    subject: z.string(),
    thesis: z.string().optional(),
    genre: z.string().optional(),
    audience: z.string().optional(),
    constraints: z.array(z.string()).default([]),
  }),
  sourceThroughTarget: z.array(z.string()).default([]),
  targetThroughSource: z.array(z.string()).default([]),
  entanglements: z.array(EntanglementSchema).default([]),
  cuts: z.array(AgentialCutSchema).default([]),
  emergentVoice: z.object({
    description: z.string(),
    generationDirectives: z.array(z.string()).default([]),
    prohibitedShortcuts: z.array(z.string()).default([]),
  }),
  evaluationCriteria: z.array(z.object({
    name: z.string(),
    description: z.string(),
    weight: z.number().min(0).max(1),
  })).default([]),
  createdAt: z.string().datetime(),
});

export type DiffractiveStylePlan = z.infer<typeof DiffractiveStylePlanSchema>;

export function createStyleProfile(
  partial: Omit<Partial<StyleProfile>, "id" | "version" | "createdAt"> & {
    authorIntent: StyleProfile["authorIntent"];
    summary: string;
  }
): StyleProfile {
  return StyleProfileSchema.parse({
    id: crypto.randomUUID(),
    version: "1.0",
    patterns: [],
    contentPillars: [],
    signature: {
      invariants: [],
      variables: [],
      productiveTensions: [],
      antiPatterns: [],
    },
    ethicalBoundary: {
      preserveMechanismsNotSurface: true,
      forbiddenVerbatimReuse: true,
      notes: [],
    },
    createdAt: new Date().toISOString(),
    ...partial,
  });
}

export function createDiffractiveStylePlan(
  partial: Omit<Partial<DiffractiveStylePlan>, "id" | "version" | "createdAt"> & {
    profileId: string;
    target: DiffractiveStylePlan["target"];
    emergentVoice: DiffractiveStylePlan["emergentVoice"];
  }
): DiffractiveStylePlan {
  return DiffractiveStylePlanSchema.parse({
    id: crypto.randomUUID(),
    version: "1.0",
    sourceThroughTarget: [],
    targetThroughSource: [],
    entanglements: [],
    cuts: [],
    evaluationCriteria: [],
    createdAt: new Date().toISOString(),
    ...partial,
  });
}
