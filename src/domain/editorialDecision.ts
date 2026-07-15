import { z } from "zod";
import { EditorialScopeSchema } from "./contentRelation";
import {
  canBecomeEditorialDecision,
  type ContentStyleArticulation,
} from "./contentStyleArticulation";

export const EditorialDecisionStatusSchema = z.enum([
  "active",
  "superseded",
  "revoked",
]);

export type EditorialDecisionStatus = z.infer<
  typeof EditorialDecisionStatusSchema
>;

/**
 * Décision canonique validée par l'auteur.
 * Elle constitue la seule autorité exécutable issue d'une articulation.
 */
export const EditorialDecisionSchema = z.object({
  id: z.string(),
  projectId: z.string().min(1),
  version: z.number().int().positive(),
  scope: EditorialScopeSchema,
  articulationId: z.string().min(1),
  contentCommitments: z.array(z.string().min(1)).min(1),
  formalCommitments: z.array(z.string().min(1)).min(1),
  invariants: z.array(z.string().min(1)).default([]),
  prohibitedShortcuts: z.array(z.string().min(1)).default([]),
  validation: z.object({
    validatedBy: z.literal("author"),
    validatedAt: z.string().datetime(),
    note: z.string().min(1).optional(),
  }),
  status: EditorialDecisionStatusSchema.default("active"),
  supersedesDecisionId: z.string().min(1).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type EditorialDecision = z.infer<typeof EditorialDecisionSchema>;
export type EditorialDecisionInput = z.input<typeof EditorialDecisionSchema>;

export interface CreateEditorialDecisionInput {
  projectId: string;
  version?: number;
  contentCommitments: string[];
  formalCommitments: string[];
  invariants?: string[];
  prohibitedShortcuts?: string[];
  validationNote?: string;
  supersedesDecisionId?: string;
}

/**
 * Crée une décision depuis une articulation explicitement validée.
 * Une articulation candidate, rejetée ou suspendue est refusée.
 */
export function createEditorialDecision(
  articulation: ContentStyleArticulation,
  input: CreateEditorialDecisionInput
): EditorialDecision {
  if (!canBecomeEditorialDecision(articulation)) {
    throw new Error(
      `Articulation ${articulation.id} must be accepted or modified before creating a decision`
    );
  }

  const now = new Date().toISOString();

  return EditorialDecisionSchema.parse({
    id: crypto.randomUUID(),
    projectId: input.projectId,
    version: input.version ?? 1,
    scope: articulation.scope,
    articulationId: articulation.id,
    contentCommitments: input.contentCommitments,
    formalCommitments: input.formalCommitments,
    invariants: input.invariants ?? [],
    prohibitedShortcuts: input.prohibitedShortcuts ?? [],
    validation: {
      validatedBy: "author",
      validatedAt: now,
      note: input.validationNote,
    },
    status: "active",
    supersedesDecisionId: input.supersedesDecisionId,
    createdAt: now,
    updatedAt: now,
  });
}

export function isEditorialDecisionExecutable(
  decision: EditorialDecision
): boolean {
  return decision.status === "active";
}
