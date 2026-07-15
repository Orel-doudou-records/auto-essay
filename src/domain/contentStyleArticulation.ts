import { z } from "zod";
import {
  EditorialScopeSchema,
  type EditorialScopeInput,
} from "./contentRelation";
import {
  StylisticOperationCategorySchema,
  StylisticOperationFamilySchema,
} from "./styleObservation";

/**
 * Opération formelle proposée dans le contexte d'un projet.
 * Elle est distincte d'ObservedStylisticOperation : l'une décrit une pratique
 * observée, l'autre une opération envisagée pour une unité future.
 */
export const PlannedStylisticOperationSchema = z.object({
  family: StylisticOperationFamilySchema,
  category: StylisticOperationCategorySchema,
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
  rationale: z.string().min(3),
  intensity: z.enum(["subtle", "moderate", "structuring"]).default("moderate"),
});

export type PlannedStylisticOperation = z.infer<
  typeof PlannedStylisticOperationSchema
>;
export type PlannedStylisticOperationInput = z.input<
  typeof PlannedStylisticOperationSchema
>;

export const ArticulationEffectsSchema = z.object({
  /** Transformation attendue de l'organisation ou du traitement du contenu. */
  content: z.array(z.string().min(1)).min(1),

  /** Transformation formelle attendue dans le texte. */
  form: z.array(z.string().min(1)).min(1),

  argumentative: z.array(z.string().min(1)).default([]),
  epistemic: z.array(z.string().min(1)).default([]),
  emotional: z.array(z.string().min(1)).default([]),
  reception: z.array(z.string().min(1)).default([]),
});

export type ArticulationEffects = z.infer<typeof ArticulationEffectsSchema>;
export type ArticulationEffectsInput = z.input<typeof ArticulationEffectsSchema>;

export const EditorialRiskSchema = z.object({
  description: z.string().min(1),
  impact: z.enum(["low", "medium", "high"]),
  mitigation: z.string().min(1).optional(),
});

export type EditorialRisk = z.infer<typeof EditorialRiskSchema>;
export type EditorialRiskInput = z.input<typeof EditorialRiskSchema>;

export const EditorialAlternativeSchema = z.object({
  description: z.string().min(1),
  tradeoffs: z.array(z.string().min(1)).min(1),
});

export type EditorialAlternative = z.infer<typeof EditorialAlternativeSchema>;
export type EditorialAlternativeInput = z.input<
  typeof EditorialAlternativeSchema
>;

/**
 * Objet central de Literacraft dans Auto Essay.
 * Il relie une configuration de contenu déjà identifiée à des opérations
 * d'écriture et aux effets qu'elles cherchent à produire.
 */
export const ContentStyleArticulationSchema = z.object({
  id: z.string(),
  scope: EditorialScopeSchema,
  contentRelationIds: z.array(z.string().min(1)).min(1),
  supportingObservationIds: z.array(z.string().min(1)).default([]),
  stylisticOperations: z.array(PlannedStylisticOperationSchema).min(1),
  intendedEffects: ArticulationEffectsSchema,
  risks: z.array(EditorialRiskSchema).default([]),
  alternatives: z.array(EditorialAlternativeSchema).default([]),
  origin: z.enum([
    "author_declared",
    "system_proposed",
    "co_constructed",
  ]),
  status: z
    .enum(["candidate", "accepted", "modified", "rejected", "suspended"])
    .default("candidate"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ContentStyleArticulation = z.infer<
  typeof ContentStyleArticulationSchema
>;
export type ContentStyleArticulationInput = z.input<
  typeof ContentStyleArticulationSchema
>;

export function createContentStyleArticulation(
  partial: Omit<
    Partial<ContentStyleArticulationInput>,
    "id" | "createdAt" | "updatedAt"
  > & {
    scope: EditorialScopeInput;
    contentRelationIds: string[];
    stylisticOperations: PlannedStylisticOperationInput[];
    intendedEffects: ArticulationEffectsInput;
    origin: ContentStyleArticulationInput["origin"];
  }
): ContentStyleArticulation {
  const now = new Date().toISOString();

  return ContentStyleArticulationSchema.parse({
    id: crypto.randomUUID(),
    supportingObservationIds: [],
    risks: [],
    alternatives: [],
    status: "candidate",
    createdAt: now,
    updatedAt: now,
    ...partial,
  });
}

/**
 * Une articulation validée peut servir à créer une décision éditoriale.
 * Elle ne devient jamais directement une directive pour le writer.
 */
export function canBecomeEditorialDecision(
  articulation: ContentStyleArticulation
): boolean {
  return articulation.status === "accepted" || articulation.status === "modified";
}
