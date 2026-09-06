import {
  EvaluatedStyleEffectSchema as SharedEvaluatedStyleEffectSchema,
  StyleObservationSchema as SharedStyleObservationSchema,
  TransformationTraceSchema as SharedTransformationTraceSchema,
  type EvaluatedStyleEffect as SharedEvaluatedStyleEffect,
  type StyleObservation as SharedStyleObservation,
  type TransformationTrace as SharedTransformationTrace,
} from "writing-engine";
import type { EditorialCriterionResult, EditorialEffectEvaluation } from "../domain/editorialEffectEvaluation";
import type { StyleObservation } from "../domain/styleObservation";
import type { TransformationTrace } from "../domain/transformationTrace";

export function toWritingEngineStyleObservation(
  source: StyleObservation
): SharedStyleObservation {
  const { contentConfiguration, observedEffects } = source;
  const signals = [
    ...(contentConfiguration.argumentativeFunction
      ? [
          {
            kind: "argumentative_function",
            value: contentConfiguration.argumentativeFunction,
          },
        ]
      : []),
    ...contentConfiguration.claimTypes.map((value) => ({
      kind: "claim_type",
      value,
    })),
    ...contentConfiguration.sourceRegimes.map((value) => ({
      kind: "source_regime",
      value,
    })),
    ...contentConfiguration.relations.map((value) => ({
      kind: "relation",
      value,
    })),
    ...contentConfiguration.tensions.map((value) => ({
      kind: "tension",
      value,
    })),
    ...contentConfiguration.concepts.map((value) => ({
      kind: "concept",
      value,
    })),
  ];
  const effects = [
    ...observedEffects.argumentative.map((statement) => ({
      kind: "argumentative",
      statement,
    })),
    ...observedEffects.epistemic.map((statement) => ({
      kind: "epistemic",
      statement,
    })),
    ...observedEffects.emotional.map((statement) => ({
      kind: "emotional",
      statement,
    })),
    ...observedEffects.reception.map((statement) => ({
      kind: "reception",
      statement,
    })),
  ];

  return SharedStyleObservationSchema.parse({
    id: source.id,
    authorId: source.authorId,
    sourceTextId: source.sourceTextId,
    situation: { signals },
    operations: source.formalOperations,
    effects,
    evidence: source.evidence,
    provenance: source.provenance,
    confidence: source.confidence,
    maturity: source.maturity,
    createdAt: source.createdAt,
  });
}

export function toWritingEngineTransformationTrace(
  source: TransformationTrace
): SharedTransformationTrace {
  return SharedTransformationTraceSchema.parse({
    id: source.id,
    unitRef: { kind: "draft-unit", id: source.unitId },
    unitVersion: source.unitVersion,
    operationRef: { kind: "editorial-directive", id: source.directiveId },
    provenanceRefs: [
      { kind: "writer-projection", id: source.projectionId },
      { kind: "editorial-plan", id: source.planId },
      { kind: "editorial-decision", id: source.decisionId },
      { kind: "content-style-articulation", id: source.articulationId },
    ],
    declaration: source.declaration,
    evidence: {
      excerpt: source.location.excerpt,
      ...(source.location.start !== undefined
        ? { location: { start: source.location.start, end: source.location.end } }
        : {}),
    },
    status: source.status,
    createdAt: source.createdAt,
  });
}

export function toWritingEngineEvaluatedStyleEffect(
  evaluation: EditorialEffectEvaluation,
  criterion: EditorialCriterionResult
): SharedEvaluatedStyleEffect {
  return SharedEvaluatedStyleEffectSchema.parse({
    id: `${evaluation.id}:${criterion.criterionId}`,
    scopeRef: { kind: "draft-unit-version", id: `${evaluation.unitId}@${evaluation.unitVersion}` },
    operationRef: { kind: "editorial-criterion", id: criterion.criterionId },
    traceRefs: criterion.traceIds.map((id) => ({ kind: "transformation-trace", id })),
    status: criterion.status,
    intendedEffects: [],
    observedEffects: [
      ...criterion.contentFindings.map((statement) => ({ kind: "content", statement })),
      ...criterion.formFindings.map((statement) => ({ kind: "form", statement })),
    ],
    unintendedEffects: criterion.unintendedEffects.map((statement) => ({ kind: "unintended", statement })),
    evidence: criterion.evidence.map((item) => ({
      excerpt: item.excerpt,
      ...(item.start !== undefined ? { location: { start: item.start, end: item.end } } : {}),
    })),
    repairSuggestion: criterion.suggestedRepair,
    evaluatedAt: evaluation.evaluatedAt,
    evaluator: evaluation.evaluatorModel,
  });
}
