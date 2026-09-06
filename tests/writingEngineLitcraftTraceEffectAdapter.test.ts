import { describe, expect, it } from "vitest";
import {
  EvaluatedStyleEffectSchema as SharedEvaluatedStyleEffectSchema,
  TransformationTraceSchema as SharedTransformationTraceSchema,
  evaluatedStyleEffectToContextBlock,
} from "writing-engine";
import {
  EditorialCriterionResultSchema,
  EditorialEffectEvaluationSchema,
} from "../src/domain/editorialEffectEvaluation";
import { TransformationTraceSchema } from "../src/domain/transformationTrace";
import {
  toWritingEngineEvaluatedStyleEffect,
  toWritingEngineTransformationTrace,
} from "../src/editorial/writingEngineLitcraftAdapter";

describe("Writing Engine Litcraft trace and effect adapter", () => {
  it("maps a writer declaration to a shared trace without assigning it an effect", () => {
    const trace = TransformationTraceSchema.parse({
      id: "trace-1",
      unitId: "unit-1",
      unitVersion: 3,
      projectionId: "projection-1",
      planId: "plan-1",
      directiveId: "directive-1",
      decisionId: "decision-1",
      articulationId: "articulation-1",
      declaration: "Condense the transition.",
      location: { excerpt: "The transition remains too long.", start: 4, end: 36 },
      status: "declared",
      createdAt: "2026-09-06T12:00:00.000Z",
    });

    const mapped = toWritingEngineTransformationTrace(trace);

    expect(() => SharedTransformationTraceSchema.parse(mapped)).not.toThrow();
    expect(mapped).toEqual({
      id: "trace-1",
      unitRef: { kind: "draft-unit", id: "unit-1" },
      unitVersion: 3,
      operationRef: { kind: "editorial-directive", id: "directive-1" },
      provenanceRefs: [
        { kind: "writer-projection", id: "projection-1" },
        { kind: "editorial-plan", id: "plan-1" },
        { kind: "editorial-decision", id: "decision-1" },
        { kind: "content-style-articulation", id: "articulation-1" },
      ],
      declaration: "Condense the transition.",
      evidence: { excerpt: "The transition remains too long.", location: { start: 4, end: 36 } },
      status: "declared",
      createdAt: "2026-09-06T12:00:00.000Z",
    });
    expect(mapped).not.toHaveProperty("score");
  });

  it("maps an editorial criterion result as shared feedback without moving AutoEssay scores or gates", () => {
    const criterion = EditorialCriterionResultSchema.parse({
      criterionId: "criterion-1",
      decisionId: "decision-1",
      articulationId: "articulation-1",
      directiveIds: ["directive-1", "directive-2"],
      traceIds: ["trace-1", "trace-2"],
      status: "partially_effective",
      contentScore: 7,
      formScore: 6,
      contentFindings: ["The argument remains visible."],
      formFindings: ["The sentence break clarifies the turn."],
      evidence: [{ excerpt: "A short sentence makes the contradiction visible.", start: 2, end: 49 }],
      unintendedEffects: ["The rhythm becomes abrupt."],
      suggestedRepair: "Restore one connective phrase.",
    });
    const evaluation = EditorialEffectEvaluationSchema.parse({
      id: "evaluation-1",
      unitId: "unit-1",
      unitVersion: 3,
      projectionId: "projection-1",
      planId: "plan-1",
      criterionResults: [criterion],
      contentFormCoherence: 7,
      overallEditorialScore: 6.5,
      summary: "The effect is visible but needs repair.",
      evaluatedAt: "2026-09-06T13:00:00.000Z",
      evaluatorModel: "editorial-judge",
    });

    const mapped = toWritingEngineEvaluatedStyleEffect(evaluation, criterion);

    expect(() => SharedEvaluatedStyleEffectSchema.parse(mapped)).not.toThrow();
    expect(mapped).toEqual({
      id: "evaluation-1:criterion-1",
      scopeRef: { kind: "draft-unit-version", id: "unit-1@3" },
      operationRef: { kind: "editorial-criterion", id: "criterion-1" },
      traceRefs: [
        { kind: "transformation-trace", id: "trace-1" },
        { kind: "transformation-trace", id: "trace-2" },
      ],
      status: "partially_effective",
      intendedEffects: [],
      observedEffects: [
        { kind: "content", statement: "The argument remains visible." },
        { kind: "form", statement: "The sentence break clarifies the turn." },
      ],
      unintendedEffects: [{ kind: "unintended", statement: "The rhythm becomes abrupt." }],
      evidence: [{ excerpt: "A short sentence makes the contradiction visible.", location: { start: 2, end: 49 } }],
      repairSuggestion: "Restore one connective phrase.",
      evaluatedAt: "2026-09-06T13:00:00.000Z",
      evaluator: "editorial-judge",
    });
    expect(mapped).not.toHaveProperty("contentScore");
    expect(mapped).not.toHaveProperty("overallEditorialScore");

    expect(evaluatedStyleEffectToContextBlock(mapped)).toMatchObject({
      ref: { kind: "style-effect", id: "evaluation-1:criterion-1" },
      label: "Evaluated style effect",
      text: expect.stringContaining("observed: content: The argument remains visible."),
    });
  });
});
