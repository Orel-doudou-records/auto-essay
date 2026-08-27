import { z } from "zod";
import type { DraftUnit } from "./draftUnit";
import type { EditorialDecision } from "./editorialDecision";
import {
  EvaluatorEditorialProjectionSchema,
  WriterEditorialProjectionSchema,
  type EvaluatorEditorialProjection,
  type WriterEditorialProjection,
} from "./editorialProjection";
import {
  TransformationTraceSchema,
  type TransformationTrace,
} from "./transformationTrace";
import { sameStringSet } from "../utils/array";

export const IntegratedEvaluationReadinessReasonCodeSchema = z.enum([
  "missing_context",
  "missing_evaluator_projection",
  "context_mismatch",
  "missing_active_decision",
  "missing_compatible_traces",
]);
export type IntegratedEvaluationReadinessReasonCode = z.infer<
  typeof IntegratedEvaluationReadinessReasonCodeSchema
>;

export const IntegratedEvaluationContextSchema = z.object({
  unitId: z.string().min(1),
  unitVersion: z.number().int().positive(),
  editorialPlanId: z.string().min(1),
  decisionIds: z.array(z.string().min(1)).min(1),
  writerProjection: WriterEditorialProjectionSchema,
  evaluatorProjection: EvaluatorEditorialProjectionSchema,
  transformationTraces: z.array(TransformationTraceSchema),
  createdAt: z.string().datetime(),
});
export type IntegratedEvaluationContext = z.infer<
  typeof IntegratedEvaluationContextSchema
>;

export type IntegratedEvaluationReadinessContextCandidate = Omit<
  IntegratedEvaluationContext,
  "evaluatorProjection"
> & {
  evaluatorProjection?: EvaluatorEditorialProjection;
};

export type IntegratedEvaluationReadiness =
  | { status: "ready"; context: IntegratedEvaluationContext }
  | {
      status: "unavailable";
      reasons: Array<{ code: IntegratedEvaluationReadinessReasonCode }>;
      context?: IntegratedEvaluationContext;
    };

export function createIntegratedEvaluationContext(input: {
  writerProjection: WriterEditorialProjection;
  evaluatorProjection: EvaluatorEditorialProjection;
  transformationTraces: TransformationTrace[];
}): IntegratedEvaluationContext {
  return IntegratedEvaluationContextSchema.parse({
    unitId: input.evaluatorProjection.unitId,
    unitVersion: input.evaluatorProjection.unitVersion,
    editorialPlanId: input.evaluatorProjection.planId,
    decisionIds: input.evaluatorProjection.decisionIds,
    writerProjection: input.writerProjection,
    evaluatorProjection: input.evaluatorProjection,
    transformationTraces: input.transformationTraces,
    createdAt: new Date().toISOString(),
  });
}

/**
 * Déclare si une unité peut être soumise aux deux juges. Cette vérification est
 * pure : elle ne compile aucune projection, ne modifie aucune unité et ne
 * contacte aucun modèle.
 */
export function assessIntegratedEvaluationReadiness(input: {
  unit: DraftUnit;
  decisions: EditorialDecision[];
  context?: IntegratedEvaluationReadinessContextCandidate;
}): IntegratedEvaluationReadiness {
  if (!input.context) {
    return unavailable("missing_context");
  }
  if (!input.context.evaluatorProjection) {
    return unavailable("missing_evaluator_projection");
  }

  const { unit } = input;
  const context = IntegratedEvaluationContextSchema.parse(input.context);
  if (
    context.unitId !== unit.id ||
    context.editorialPlanId !== unit.editorialPlanId ||
    context.writerProjection.unitId !== unit.id ||
    context.writerProjection.planId !== context.editorialPlanId ||
    context.evaluatorProjection.planId !== context.editorialPlanId ||
    !sameStringSet(context.decisionIds, context.writerProjection.decisionIds) ||
    !sameStringSet(context.decisionIds, context.evaluatorProjection.decisionIds) ||
    !sameStringSet(
      context.writerProjection.articulationIds,
      context.evaluatorProjection.articulationIds
    )
  ) {
    return unavailable("context_mismatch");
  }

  const matchesCurrentVersion =
    context.unitVersion === unit.version &&
    context.writerProjection.unitVersion === unit.version &&
    context.evaluatorProjection.unitVersion === unit.version;
  const awaitsFirstExplicitGeneration =
    unit.content.trim().length === 0 &&
    context.unitVersion === unit.version + 1 &&
    context.writerProjection.unitVersion === context.unitVersion &&
    context.evaluatorProjection.unitVersion === context.unitVersion;
  if (!matchesCurrentVersion && !awaitsFirstExplicitGeneration) {
    return unavailable("context_mismatch");
  }

  const activeDecisionIds = new Set(
    input.decisions
      .filter((decision) => decision.status === "active")
      .map((decision) => decision.id)
  );
  if (
    context.decisionIds.some((decisionId) => !activeDecisionIds.has(decisionId)) ||
    context.decisionIds.some((decisionId) => !unit.appliedDecisionIds.includes(decisionId))
  ) {
    return unavailable("missing_active_decision");
  }

  const compatibleTraces = context.transformationTraces.filter(
    (trace) =>
      unit.transformationTraceIds.includes(trace.id) &&
      trace.unitId === unit.id &&
      trace.unitVersion === unit.version &&
      trace.planId === context.editorialPlanId &&
      trace.projectionId === context.writerProjection.id &&
      context.writerProjection.directives.some(
        (directive) =>
          directive.id === trace.directiveId &&
          directive.decisionId === trace.decisionId &&
          directive.articulationId === trace.articulationId
      ) &&
      context.evaluatorProjection.criteria.some(
        (criterion) =>
          criterion.directiveIds.includes(trace.directiveId) &&
          criterion.decisionId === trace.decisionId &&
          criterion.articulationId === trace.articulationId
      )
  );
  if (compatibleTraces.length === 0) {
    return unavailable("missing_compatible_traces", context);
  }

  return { status: "ready", context };
}

function unavailable(
  code: IntegratedEvaluationReadinessReasonCode,
  context?: IntegratedEvaluationContext
): IntegratedEvaluationReadiness {
  return { status: "unavailable", reasons: [{ code }], context };
}
