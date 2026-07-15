import { z } from "zod";
import { EssayEvaluationSchema } from "./evaluation";

export const EditorialEffectStatusSchema = z.enum([
  "absent",
  "present_ineffective",
  "partially_effective",
  "effective",
  "harmful",
]);

export type EditorialEffectStatus = z.infer<
  typeof EditorialEffectStatusSchema
>;

export const EditorialEvidenceExcerptSchema = z
  .object({
    excerpt: z.string().min(1),
    start: z.number().int().nonnegative().optional(),
    end: z.number().int().positive().optional(),
  })
  .superRefine((evidence, context) => {
    const hasStart = evidence.start !== undefined;
    const hasEnd = evidence.end !== undefined;

    if (hasStart !== hasEnd) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Editorial evidence offsets require both start and end",
      });
    }

    if (
      evidence.start !== undefined &&
      evidence.end !== undefined &&
      evidence.end <= evidence.start
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Editorial evidence end must be greater than start",
      });
    }
  });

export const EditorialCriterionResultSchema = z
  .object({
    criterionId: z.string().min(1),
    decisionId: z.string().min(1),
    articulationId: z.string().min(1),
    directiveIds: z.array(z.string().min(1)).min(1),
    traceIds: z.array(z.string().min(1)).default([]),
    status: EditorialEffectStatusSchema,
    contentScore: z.number().min(0).max(10),
    formScore: z.number().min(0).max(10),
    contentFindings: z.array(z.string().min(1)).min(1),
    formFindings: z.array(z.string().min(1)).min(1),
    evidence: z.array(EditorialEvidenceExcerptSchema).default([]),
    unintendedEffects: z.array(z.string().min(1)).default([]),
    suggestedRepair: z.string().min(1).optional(),
  })
  .superRefine((result, context) => {
    if (result.status !== "absent" && result.evidence.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["evidence"],
        message: "A present editorial effect requires textual evidence",
      });
    }

    if (
      result.status !== "effective" &&
      result.suggestedRepair === undefined
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["suggestedRepair"],
        message: "A non-effective editorial result requires a repair suggestion",
      });
    }
  });

export type EditorialCriterionResult = z.infer<
  typeof EditorialCriterionResultSchema
>;

export const EditorialEffectEvaluationSchema = z.object({
  id: z.string(),
  unitId: z.string().min(1),
  unitVersion: z.number().int().positive(),
  projectionId: z.string().min(1),
  planId: z.string().min(1),
  criterionResults: z.array(EditorialCriterionResultSchema).min(1),
  contentFormCoherence: z.number().min(0).max(10),
  overallEditorialScore: z.number().min(0).max(10),
  summary: z.string().min(1),
  evaluatedAt: z.string().datetime(),
  evaluatorModel: z.string().min(1),
});

export type EditorialEffectEvaluation = z.infer<
  typeof EditorialEffectEvaluationSchema
>;

export const IntegratedEvaluationSchema = z.object({
  essay: EssayEvaluationSchema,
  editorial: EditorialEffectEvaluationSchema.optional(),
  gates: z.object({
    documentaryIntegrity: z.enum(["pass", "fail"]),
    editorialCoherence: z.enum(["pass", "fail", "not_assessed"]),
  }),
  finalVerdict: z.enum([
    "keep",
    "keep_with_minor_edits",
    "revise",
    "discard",
  ]),
});

export type IntegratedEvaluation = z.infer<typeof IntegratedEvaluationSchema>;

/**
 * Combine deux évaluations sans permettre à la forme de compenser un échec
 * de preuves, de citations ou de portée documentaire.
 */
export function createIntegratedEvaluation(
  essay: z.infer<typeof EssayEvaluationSchema>,
  editorial?: EditorialEffectEvaluation
): IntegratedEvaluation {
  const documentaryIntegrity = hasDocumentaryIntegrity(essay)
    ? "pass"
    : "fail";
  const editorialCoherence = editorial
    ? hasEditorialCoherence(editorial)
      ? "pass"
      : "fail"
    : "not_assessed";

  let finalVerdict = essay.verdict;

  if (essay.verdict === "discard") {
    finalVerdict = "discard";
  } else if (documentaryIntegrity === "fail") {
    finalVerdict = "revise";
  } else if (editorialCoherence === "fail") {
    finalVerdict = "revise";
  }

  return IntegratedEvaluationSchema.parse({
    essay,
    editorial,
    gates: {
      documentaryIntegrity,
      editorialCoherence,
    },
    finalVerdict,
  });
}

export function hasDocumentaryIntegrity(
  essay: z.infer<typeof EssayEvaluationSchema>
): boolean {
  const criticalDocumentaryWeakness = essay.weaknesses.some(
    (weakness) =>
      weakness.severity === "critical" &&
      (weakness.dimension === "claimSupport" ||
        weakness.dimension === "citationIntegrity" ||
        weakness.dimension === "scopeControl")
  );

  return (
    essay.dimensions.claimSupport >= 6 &&
    essay.dimensions.citationIntegrity >= 6 &&
    essay.dimensions.scopeControl >= 6 &&
    !criticalDocumentaryWeakness
  );
}

export function hasEditorialCoherence(
  editorial: EditorialEffectEvaluation
): boolean {
  return (
    editorial.overallEditorialScore >= 6 &&
    editorial.contentFormCoherence >= 6 &&
    !editorial.criterionResults.some((result) => result.status === "harmful")
  );
}
