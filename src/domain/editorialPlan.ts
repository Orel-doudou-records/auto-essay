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

/**
 * Plan local d'un paragraphe. Les décisions héritées et locales sont séparées
 * pour que la projection future puisse expliquer l'origine de chaque contrainte.
 */
export const ParagraphEditorialPlanSchema = z
  .object({
    id: z.string(),
    order: z.number().int().nonnegative(),
    plan: EditorialPlanSchema,
    inheritedDecisionIds: z.array(z.string().min(1)).default([]),
    localDecisionIds: z.array(z.string().min(1)).default([]),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .superRefine((paragraph, context) => {
    if (paragraph.plan.scope.level !== "paragraph") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["plan", "scope", "level"],
        message: "A paragraph editorial plan requires paragraph scope",
      });
    }

    const referencedDecisionIds = new Set([
      ...paragraph.inheritedDecisionIds,
      ...paragraph.localDecisionIds,
    ]);
    const planDecisionIds = new Set(paragraph.plan.decisionIds);

    if (!sameStringSet(referencedDecisionIds, planDecisionIds)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["plan", "decisionIds"],
        message:
          "Paragraph plan decisions must equal inherited and local decisions",
      });
    }
  });

export type ParagraphEditorialPlan = z.infer<
  typeof ParagraphEditorialPlanSchema
>;
export type ParagraphEditorialPlanInput = z.input<
  typeof ParagraphEditorialPlanSchema
>;

/**
 * Agrégat de planification d'une section et de ses paragraphes.
 */
export const SectionEditorialPlanSchema = z
  .object({
    id: z.string(),
    plan: EditorialPlanSchema,
    paragraphs: z.array(ParagraphEditorialPlanSchema).min(1),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .superRefine((section, context) => {
    if (section.plan.scope.level !== "section") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["plan", "scope", "level"],
        message: "A section editorial plan requires section scope",
      });
    }

    const sectionId = section.plan.scope.sectionId;
    const projectId = section.plan.scope.projectId;
    const orders = new Set<number>();

    for (const [index, paragraph] of section.paragraphs.entries()) {
      if (orders.has(paragraph.order)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["paragraphs", index, "order"],
          message: "Paragraph orders must be unique",
        });
      }
      orders.add(paragraph.order);

      if (
        paragraph.plan.scope.projectId !== projectId ||
        paragraph.plan.scope.sectionId !== sectionId
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["paragraphs", index, "plan", "scope"],
          message: "Paragraph scope must belong to the parent section",
        });
      }
    }
  });

export type SectionEditorialPlan = z.infer<typeof SectionEditorialPlanSchema>;
export type SectionEditorialPlanInput = z.input<
  typeof SectionEditorialPlanSchema
>;

function sameStringSet(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) {
    return false;
  }

  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }

  return true;
}
