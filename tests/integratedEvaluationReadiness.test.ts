import { describe, expect, it } from "vitest";
import {
  assessIntegratedEvaluationReadiness,
  createDraftUnit,
  createIntegratedEvaluationContext,
  EditorialDecisionSchema,
  EvaluatorEditorialProjectionSchema,
  TransformationTraceSchema,
  WriterEditorialProjectionSchema,
} from "../src/index";

const now = "2026-08-27T12:00:00.000Z";

function readyFixture() {
  const unit = createDraftUnit({
    projectId: "project-1",
    granularity: "paragraph",
    content: "Le texte distingue les archives et ralentit la transition.",
    editorialPlanId: "plan-1",
    appliedDecisionIds: ["decision-1"],
    appliedArticulationIds: ["articulation-1"],
    transformationTraceIds: ["trace-1"],
  });
  const base = {
    planId: "plan-1",
    unitId: unit.id,
    unitVersion: unit.version,
    scope: {
      level: "paragraph" as const,
      projectId: "project-1",
      sectionId: "section-1",
      paragraphId: "paragraph-1",
    },
    decisionIds: ["decision-1"],
    articulationIds: ["articulation-1"],
    createdAt: now,
  };
  const writerProjection = WriterEditorialProjectionSchema.parse({
    ...base,
    id: "writer-projection-1",
    type: "writer",
    argumentativeFunction: "Distinguer les archives",
    directives: [
      {
        id: "directive-1",
        decisionId: "decision-1",
        articulationId: "articulation-1",
        kind: "form",
        instruction: "Ralentir la transition.",
      },
    ],
    intendedEffects: { content: ["Distinguer les archives"], form: ["Ralentir la transition"] },
  });
  const evaluatorProjection = EvaluatorEditorialProjectionSchema.parse({
    ...base,
    id: "evaluator-projection-1",
    type: "evaluator",
    criteria: [
      {
        id: "criterion-1",
        decisionId: "decision-1",
        articulationId: "articulation-1",
        directiveIds: ["directive-1"],
        instruction: "Distinguer les archives et ralentir la transition.",
        expectedContentEffects: ["Distinguer les archives"],
        expectedFormEffects: ["Ralentir la transition"],
      },
    ],
    intendedEffects: { content: ["Distinguer les archives"], form: ["Ralentir la transition"] },
  });
  const decision = EditorialDecisionSchema.parse({
    id: "decision-1",
    projectId: "project-1",
    version: 1,
    scope: base.scope,
    articulationId: "articulation-1",
    contentCommitments: ["Distinguer les archives"],
    formalCommitments: ["Ralentir la transition"],
    validation: { validatedBy: "author", validatedAt: now },
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
  const trace = TransformationTraceSchema.parse({
    id: "trace-1",
    unitId: unit.id,
    unitVersion: unit.version,
    projectionId: writerProjection.id,
    planId: "plan-1",
    directiveId: "directive-1",
    decisionId: "decision-1",
    articulationId: "articulation-1",
    declaration: "La transition a été ralentie.",
    location: { excerpt: "ralentit la transition" },
    status: "declared",
    createdAt: now,
  });

  return {
    unit,
    decision,
    context: createIntegratedEvaluationContext({
      writerProjection,
      evaluatorProjection,
      transformationTraces: [trace],
    }),
  };
}

describe("integrated evaluation readiness", () => {
  it("reports a missing canonical context for a unit without editorial preparation", () => {
    const unit = createDraftUnit({
      projectId: "project-1",
      granularity: "paragraph",
      content: "Une unité documentaire sans engagement éditorial préparé.",
    });

    expect(
      assessIntegratedEvaluationReadiness({
        unit,
        decisions: [],
      })
    ).toEqual({
      status: "unavailable",
      reasons: [{ code: "missing_context" }],
    });
  });

  it("reports a missing evaluator projection without treating the whole context as absent", () => {
    const fixture = readyFixture();

    expect(
      assessIntegratedEvaluationReadiness({
        unit: fixture.unit,
        decisions: [fixture.decision],
        context: { ...fixture.context, evaluatorProjection: undefined },
      })
    ).toEqual({
      status: "unavailable",
      reasons: [{ code: "missing_evaluator_projection" }],
    });
  });

  it("reports a ready context only when its projections, decision and writer trace match the unit", () => {
    const fixture = readyFixture();

    expect(
      assessIntegratedEvaluationReadiness({
        unit: fixture.unit,
        decisions: [fixture.decision],
        context: fixture.context,
      })
    ).toEqual({ status: "ready", context: fixture.context });
  });

  it("refuses a context whose evaluator projection names different decisions", () => {
    const fixture = readyFixture();
    const inconsistentContext = {
      ...fixture.context,
      evaluatorProjection: {
        ...fixture.context.evaluatorProjection,
        decisionIds: ["another-decision"],
      },
    };

    expect(
      assessIntegratedEvaluationReadiness({
        unit: fixture.unit,
        decisions: [fixture.decision],
        context: inconsistentContext,
      })
    ).toEqual({
      status: "unavailable",
      reasons: [{ code: "context_mismatch" }],
    });
  });

  it("refuses a writer trace whose directive is absent from the evaluator projection", () => {
    const fixture = readyFixture();
    const incompatibleContext = {
      ...fixture.context,
      transformationTraces: [
        {
          ...fixture.context.transformationTraces[0]!,
          directiveId: "unknown-directive",
        },
      ],
    };

    expect(
      assessIntegratedEvaluationReadiness({
        unit: fixture.unit,
        decisions: [fixture.decision],
        context: incompatibleContext,
      })
    ).toEqual({
      status: "unavailable",
      reasons: [{ code: "missing_compatible_traces" }],
      context: incompatibleContext,
    });
  });

  it("refuses a context presented for another unit", () => {
    const fixture = readyFixture();

    expect(
      assessIntegratedEvaluationReadiness({
        unit: { ...fixture.unit, id: "another-unit" },
        decisions: [fixture.decision],
        context: fixture.context,
      })
    ).toEqual({
      status: "unavailable",
      reasons: [{ code: "context_mismatch" }],
    });
  });

  it("refuses a context when the unit version no longer matches its projections", () => {
    const fixture = readyFixture();

    expect(
      assessIntegratedEvaluationReadiness({
        unit: { ...fixture.unit, version: fixture.unit.version + 1 },
        decisions: [fixture.decision],
        context: fixture.context,
      })
    ).toEqual({
      status: "unavailable",
      reasons: [{ code: "context_mismatch" }],
    });
  });

  it("refuses a context whose author decision is no longer active", () => {
    const fixture = readyFixture();

    expect(
      assessIntegratedEvaluationReadiness({
        unit: fixture.unit,
        decisions: [{ ...fixture.decision, status: "revoked" }],
        context: fixture.context,
      })
    ).toEqual({
      status: "unavailable",
      reasons: [{ code: "missing_active_decision" }],
    });
  });
});
