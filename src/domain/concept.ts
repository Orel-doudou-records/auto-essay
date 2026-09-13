import { z } from "zod";
import { EditorialScopeSchema, type EditorialScope } from "./contentRelation";

/**
 * Statut de validation d'un nœud conceptuel du corpus.
 * Un concept émerge comme proposition, puis est accepté, affiné ou rejeté
 * par l'auteur — jamais imposé par le système.
 */
export const ConceptStatusSchema = z.enum([
  "proposed",
  "accepted",
  "refined",
  "rejected",
]);

export type ConceptStatus = z.infer<typeof ConceptStatusSchema>;

/**
 * Concept : nœud intellectuel situé. Les ancrages documentaires précis sont
 * des Citation ids ; les sourceIds restent un index bibliographique plus large.
 */
export const ConceptSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  label: z.string().min(1),
  definition: z.string().min(1),
  scope: EditorialScopeSchema,
  sourceIds: z.array(z.string().min(1)).default([]),
  citationIds: z.array(z.string().min(1)).default([]),
  status: ConceptStatusSchema.default("proposed"),
  createdAt: z.string().datetime(),
});

export type Concept = z.infer<typeof ConceptSchema>;
export type ConceptInput = z.input<typeof ConceptSchema>;

export function createConcept(
  partial: Omit<Partial<ConceptInput>, "id" | "createdAt"> & {
    projectId: string;
    label: string;
    definition: string;
    scope: EditorialScope;
  }
): Concept {
  return ConceptSchema.parse({
    id: crypto.randomUUID(),
    sourceIds: [],
    citationIds: [],
    status: "proposed",
    createdAt: new Date().toISOString(),
    ...partial,
  });
}
