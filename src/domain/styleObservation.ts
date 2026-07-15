import { z } from "zod";
import { ClaimTypeSchema } from "./claim";
import { SourceRegimeSchema } from "./source";

/**
 * Familles issues du Prompt stylistique avancé.
 * Elles servent à classer des opérations, pas à définir un style isolé.
 */
export const StylisticOperationFamilySchema = z.enum([
  "enunciation_structure",
  "syntax_rhythm_musicality",
  "tone_lexicon",
  "figuration_genre",
  "creative_imperfection",
]);

export type StylisticOperationFamily = z.infer<
  typeof StylisticOperationFamilySchema
>;

/**
 * Vocabulaire initial des catégories observables. Le mécanisme concret reste
 * décrit en langage naturel afin de ne pas réduire Literacraft à une taxonomie.
 */
export const StylisticOperationCategorySchema = z.enum([
  "narrator_voice",
  "author_posture",
  "narrative_distance",
  "source_distance",
  "reader_address",
  "claim_attribution",
  "voice_circulation",
  "temporal_transition",
  "scale_transition",
  "contradiction_structure",
  "resolution",
  "section_progression",
  "sentence_length",
  "syntactic_architecture",
  "coordination_subordination",
  "sentence_mode",
  "active_passive_voice",
  "punctuation",
  "pause",
  "acceleration",
  "slowdown",
  "repetition",
  "syntactic_anaphora",
  "sound_pattern",
  "tempo",
  "language_register",
  "technical_density",
  "sensory_lexicon",
  "conceptual_lexicon",
  "lexical_field",
  "semantic_shift",
  "connotation",
  "irony",
  "emotional_progression",
  "metaphor",
  "extended_metaphor",
  "symbol",
  "analogy",
  "comparison",
  "opposition",
  "paradox",
  "rhetorical_question",
  "quotation",
  "intertextuality",
  "genre_convention",
  "genre_hybridization",
  "digression",
  "fragmentation",
  "unfinished_sentence",
  "tonal_break",
  "voice_variation",
  "productive_contradiction",
  "temporal_discontinuity",
  "ambiguity",
  "silence",
  "ellipsis",
  "suspension",
  "non_resolution",
  "intentional_imbalance",
]);

export type StylisticOperationCategory = z.infer<
  typeof StylisticOperationCategorySchema
>;

export const TextLocationSchema = z
  .object({
    label: z.string().min(1).optional(),
    start: z.number().int().nonnegative().optional(),
    end: z.number().int().positive().optional(),
  })
  .superRefine((location, context) => {
    const hasOffsets = location.start !== undefined || location.end !== undefined;

    if (hasOffsets && (location.start === undefined || location.end === undefined)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Text offsets must provide both start and end",
      });
    }

    if (
      location.start !== undefined &&
      location.end !== undefined &&
      location.end <= location.start
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Text location end must be greater than start",
      });
    }

    if (location.label === undefined && !hasOffsets) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A text location must contain a label or offsets",
      });
    }
  });

export type TextLocation = z.infer<typeof TextLocationSchema>;
export type TextLocationInput = z.input<typeof TextLocationSchema>;

/**
 * Situation de contenu dans laquelle une pratique formelle a été observée.
 */
export const ObservationContentConfigurationSchema = z
  .object({
    argumentativeFunction: z.string().min(1).optional(),
    claimTypes: z.array(ClaimTypeSchema).default([]),
    sourceRegimes: z.array(SourceRegimeSchema).default([]),
    relations: z.array(z.string().min(1)).default([]),
    tensions: z.array(z.string().min(1)).default([]),
    concepts: z.array(z.string().min(1)).default([]),
  })
  .superRefine((configuration, context) => {
    const hasContentContext =
      configuration.argumentativeFunction !== undefined ||
      configuration.claimTypes.length > 0 ||
      configuration.sourceRegimes.length > 0 ||
      configuration.relations.length > 0 ||
      configuration.tensions.length > 0 ||
      configuration.concepts.length > 0;

    if (!hasContentContext) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A style observation must describe a content configuration",
      });
    }
  });

export type ObservationContentConfiguration = z.infer<
  typeof ObservationContentConfigurationSchema
>;
export type ObservationContentConfigurationInput = z.input<
  typeof ObservationContentConfigurationSchema
>;

/**
 * Une opération formelle explicite : ce qui la déclenche, ce qu'elle fait et
 * l'effet local observé. Cette structure empêche un adjectif isolé de devenir
 * un attribut stylistique valide.
 */
export const ObservedStylisticOperationSchema = z.object({
  family: StylisticOperationFamilySchema,
  category: StylisticOperationCategorySchema,
  trigger: z.string().min(3),
  operation: z.string().min(3),
  target: z.enum([
    "section",
    "paragraph",
    "sentence_group",
    "transition",
    "source_voice",
    "narrator_voice",
    "lexical_network",
    "figurative_system",
  ]),
  observedEffect: z.string().min(3),
  intensity: z.enum(["subtle", "moderate", "structuring"]).default("moderate"),
});

export type ObservedStylisticOperation = z.infer<
  typeof ObservedStylisticOperationSchema
>;
export type ObservedStylisticOperationInput = z.input<
  typeof ObservedStylisticOperationSchema
>;

export const ObservedEffectsSchema = z
  .object({
    argumentative: z.array(z.string().min(1)).default([]),
    epistemic: z.array(z.string().min(1)).default([]),
    emotional: z.array(z.string().min(1)).default([]),
    reception: z.array(z.string().min(1)).default([]),
  })
  .superRefine((effects, context) => {
    const hasEffect = Object.values(effects).some((values) => values.length > 0);

    if (!hasEffect) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A style observation must identify at least one observed effect",
      });
    }
  });

export type ObservedEffects = z.infer<typeof ObservedEffectsSchema>;
export type ObservedEffectsInput = z.input<typeof ObservedEffectsSchema>;

export const ObservationEvidenceSchema = z
  .object({
    excerpt: z.string().min(1).optional(),
    location: TextLocationSchema.optional(),
  })
  .superRefine((evidence, context) => {
    if (evidence.excerpt === undefined && evidence.location === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "An observation requires a textual excerpt or a location",
      });
    }
  });

export type ObservationEvidence = z.infer<typeof ObservationEvidenceSchema>;
export type ObservationEvidenceInput = z.input<typeof ObservationEvidenceSchema>;

export const StyleObservationSchema = z.object({
  id: z.string(),
  authorId: z.string(),
  sourceTextId: z.string(),
  contentConfiguration: ObservationContentConfigurationSchema,
  formalOperations: z.array(ObservedStylisticOperationSchema).min(1),
  observedEffects: ObservedEffectsSchema,
  evidence: ObservationEvidenceSchema,
  provenance: z.object({
    origin: z.enum([
      "author_text_analysis",
      "author_declaration",
      "editorial_annotation",
      "co_constructed",
    ]),
    notes: z.array(z.string().min(1)).default([]),
  }),
  confidence: z.enum(["low", "medium", "high"]),
  maturity: z
    .enum(["single_observation", "recurring_pattern", "validated_practice"])
    .default("single_observation"),
  createdAt: z.string().datetime(),
});

export type StyleObservation = z.infer<typeof StyleObservationSchema>;
export type StyleObservationInput = z.input<typeof StyleObservationSchema>;

export function createStyleObservation(
  partial: Omit<Partial<StyleObservationInput>, "id" | "createdAt"> & {
    authorId: string;
    sourceTextId: string;
    contentConfiguration: ObservationContentConfigurationInput;
    formalOperations: ObservedStylisticOperationInput[];
    observedEffects: ObservedEffectsInput;
    evidence: ObservationEvidenceInput;
    provenance: StyleObservationInput["provenance"];
    confidence: StyleObservationInput["confidence"];
  }
): StyleObservation {
  return StyleObservationSchema.parse({
    id: crypto.randomUUID(),
    maturity: "single_observation",
    createdAt: new Date().toISOString(),
    ...partial,
  });
}
