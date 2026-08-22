import { z } from "zod";
import { EditorialScopeSchema, type EditorialScope } from "./contentRelation";

/**
 * Statut de validation d'une tension du corpus.
 */
export const TensionStatusSchema = z.enum([
  "proposed",
  "accepted",
  "refined",
  "rejected",
]);

export type TensionStatus = z.infer<typeof TensionStatusSchema>;

/**
 * Tension : nœud de premier ordre qui nomme une opposition productive
 * entre deux pôles (concepts, régimes documentaires, temporalités).
 * Une tension n'est pas une contradiction : elle est une polarité à
 * articuler, dont l'issue n'est pas tranchée a priori.
 */
export const TensionSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  poles: z.array(z.string().min(1)).default([]),
  scope: EditorialScopeSchema,
  evidenceIds: z.array(z.string().min(1)).default([]),
  status: TensionStatusSchema.default("proposed"),
  createdAt: z.string().datetime(),
});

export type Tension = z.infer<typeof TensionSchema>;
export type TensionInput = z.input<typeof TensionSchema>;

export function createTension(
  partial: Omit<Partial<TensionInput>, "id" | "createdAt"> & {
    projectId: string;
    label: string;
    description: string;
    scope: EditorialScope;
  }
): Tension {
  return TensionSchema.parse({
    id: crypto.randomUUID(),
    poles: [],
    evidenceIds: [],
    status: "proposed",
    createdAt: new Date().toISOString(),
    ...partial,
  });
}
