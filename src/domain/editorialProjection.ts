import { z } from "zod";
import { EditorialScopeSchema } from "./contentRelation";
import {
  ArticulationEffectsSchema,
  PlannedStylisticOperationSchema,
} from "./contentStyleArticulation";

export const ProjectionDirectiveKindSchema = z.enum([
  "content",
  "form",
  "invariant",
  "prohibition",
]);

export const EditorialDirectiveSchema = z.object({
  id: z.string().min(1),
  decisionId: z.string().min(1),
  articulationId: z.string().min(1),
  kind: ProjectionDirectiveKindSchema,
  instruction: z.string().min(1),
  operation: PlannedStylisticOperationSchema.optional(),
});

export type EditorialDirective = z.infer<typeof EditorialDirectiveSchema>;

const ProjectionBaseSchema = z.object({
  id: z.string().min(1),
  planId: z.string().min(1),
  unitId: z.string().min(1),
  unitVersion: z.number().int().positive(),
  scope: EditorialScopeSchema,
  decisionIds: z.array(z.string().min(1)).min(1),
  articulationIds: z.array(z.string().min(1)).min(1),
  createdAt: z.string().datetime(),
});

export const WriterEditorialProjectionSchema = ProjectionBaseSchema.extend({
  type: z.literal("writer"),
  argumentativeFunction: z.string().min(1),
  allowedClaimIds: z.array(z.string().min(1)).default([]),
  allowedEvidenceIds: z.array(z.string().min(1)).default([]),
  allowedSourceRelationIds: z.array(z.string().min(1)).default([]),
  directives: z.array(EditorialDirectiveSchema).min(1),
  intendedEffects: ArticulationEffectsSchema,
});

export type WriterEditorialProjection = z.infer<
  typeof WriterEditorialProjectionSchema
>;

export const EvaluationCriterionSchema = z.object({
  id: z.string().min(1),
  decisionId: z.string().min(1),
  articulationId: z.string().min(1),
  directiveIds: z.array(z.string().min(1)).min(1),
  instruction: z.string().min(1),
  expectedContentEffects: z.array(z.string().min(1)).default([]),
  expectedFormEffects: z.array(z.string().min(1)).default([]),
});

export const EvaluatorEditorialProjectionSchema = ProjectionBaseSchema.extend({
  type: z.literal("evaluator"),
  criteria: z.array(EvaluationCriterionSchema).min(1),
  intendedEffects: ArticulationEffectsSchema,
});

export type EvaluatorEditorialProjection = z.infer<
  typeof EvaluatorEditorialProjectionSchema
>;

export const RevisionEditorialProjectionSchema = ProjectionBaseSchema.extend({
  type: z.literal("revision"),
  preserve: z.array(z.string().min(1)).default([]),
  avoid: z.array(z.string().min(1)).default([]),
  repairDirectives: z.array(EditorialDirectiveSchema).min(1),
});

export type RevisionEditorialProjection = z.infer<
  typeof RevisionEditorialProjectionSchema
>;

export interface EditorialProjectionBundle {
  writer: WriterEditorialProjection;
  evaluator: EvaluatorEditorialProjection;
  revision: RevisionEditorialProjection;
}
