import { z } from "zod";
import {
  EditorialScopeSchema,
  type EditorialScopeInput,
} from "./contentRelation";
import {
  ArticulationEffectsSchema,
  PlannedStylisticOperationSchema,
  type ArticulationEffectsInput,
  type PlannedStylisticOperationInput,
} from "./contentStyleArticulation";
import {
  isEditorialDecisionExecutable,
  type EditorialDecision,
} from "./editorialDecision";

export const EditorialPlanStatusSchema = z.enum([
  "draft",
  "validated",
  "superseded",
]);

export type EditorialPlanStatus = z.infer<typeof EditorialPlanStatusSchema>;

/**
 * Déclinaison située des décisions actives pour une DraftUnit.
 * Le plan référence les objets canoniques ; il ne les recopie pas.
 */
export const EditorialPlanSchema = z.object({
  id: z.string(),
  unitId: z.string().min(1),
  unitVersion: z.number().int().positive(),
  scope: EditorialScopeSchema,
  argumentativeFunction: z.string().min(1),
  claimIds: z.array(z.string().min(1)).default([]),
  evidenceIds: z.array(z.string().min(1)).default([]),
  sourceRelationIds: z.array(z.string().min(1)).default([]),
  decisionIds: z.array(z.string().min(1)).min(1),
  articulationIds: z.array(z.string().min(1)).min(1),
  contentOperations: z.array(z.string().min(1)).min(1),
  stylisticOperations: z.array(PlannedStylisticOperationSchema).min(1),
  intendedEffects: ArticulationEffectsSchema,
  invariants: z.array(z.string().min(1)).default([]),
  status: EditorialPlanStatusSchema.default("draft"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type EditorialPlan = z.infer<typeof EditorialPlanSchema>;
export type EditorialPlanInput = z.input<typeof EditorialPlanSchema>;

export interface CreateEditorialPlanInput {
  unitId: string;
  unitVersion: number;
  scope: EditorialScopeInput;
  argumentativeFunction: string;
  decisions: EditorialDecision[];
  claimIds?: string[];
  evidenceIds?: string[];
  sourceRelationIds?: string[];
  contentOperations: string[];
  stylisticOperations: PlannedStylisticOperationInput[];
  intendedEffects: ArticulationEffectsInput;
  invariants?: string[];
  status?: EditorialPlanStatus;
}

export function createEditorialPlan(
  input: CreateEditorialPlanInput
): EditorialPlan {
  const nonExecutableDecision = input.decisions.find(
    (decision) => !isEditorialDecisionExecutable(decision)
  );

  if (nonExecutableDecision) {
    throw new Error(
      `Decision ${nonExecutableDecision.id} is not active and cannot be added to an editorial plan`
    );
  }

  const decisionIds = [...new Set(input.decisions.map((decision) => decision.id))];
  const articulationIds = [
    ...new Set(input.decisions.map((decision) => decision.articulationId)),
  ];
  const now = new Date().toISOString();

  return EditorialPlanSchema.parse({
    id: crypto.randomUUID(),
    unitId: input.unitId,
    unitVersion: input.unitVersion,
    scope: input.scope,
    argumentativeFunction: input.argumentativeFunction,
    claimIds: input.claimIds ?? [],
    evidenceIds: input.evidenceIds ?? [],
    sourceRelationIds: input.sourceRelationIds ?? [],
    decisionIds,
    articulationIds,
    contentOperations: input.contentOperations,
    stylisticOperations: input.stylisticOperations,
    intendedEffects: input.intendedEffects,
    invariants: input.invariants ?? [],
    status: input.status ?? "draft",
    createdAt: now,
    updatedAt: now,
  });
}

export function isEditorialPlanExecutable(plan: EditorialPlan): boolean {
  return plan.status === "validated";
}
