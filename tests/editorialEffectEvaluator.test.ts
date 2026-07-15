import { describe, expect, it } from "vitest";
import { createDraftUnit } from "../src/domain/draftUnit";
import { EvaluatorEditorialProjectionSchema } from "../src/domain/editorialProjection";
import { TransformationTraceSchema } from "../src/domain/transformationTrace";
import { EditorialEffectEvaluator } from "../src/evaluation/editorialEffectEvaluator";

class MockClient {
  constructor(private readonly output: unknown) {}

  async generateJson(): Promise<unknown> {
    return this.output;
  }
}

function fixture() {
  const content =
    "Chaque archive nomme une chronologie différente. La divergence reste attribuée à chaque document.";
  const unit = createDraftUnit({
    projectId: "project-1",
    granularity: "paragraph",
    content,
    editorialPlanId: "plan-1",
    appliedDecisionIds: ["decision-1"],
    appliedArticulationIds: ["articulation-1"],
    transformationTraceIds: ["trace-1"],
  });
  const projection = EvaluatorEditorialProjectionSchema.parse({
    id: "projection-evaluator-1",
    type: "evaluator",
    planId: "plan-1",
    unitId: unit.id,
    unitVersion: unit.version,
    scope: {
      level: "paragraph",
      projectId: "project-1",
      sectionId: "section-1",
      paragraphId: "paragraph-1",
    },
    decisionIds: ["decision-1"],
    articulationIds: ["articulation-1"],
    createdAt: new Date().toISOString(),
    criteria: [
      {
        id: "criterion-1",
        decisionId: "decision-1",
        articulationId: "articulation-1",
        directiveIds: ["directive-content-1", "directive-form-1"],
        instruction: "Maintenir les claims distincts et attribuer chaque version.",
        expectedContentEffects: ["préserver les deux versions"],
        expectedFormEffects: ["séparer les voix documentaires"],
      },
    ],
    intendedEffects: {
      content: ["préserver les deux versions"],
      form: ["séparer les voix documentaires"],
    },
  });
  const trace = TransformationTraceSchema.parse({
    id: "trace-1",
    unitId: unit.id,
    unitVersion: unit.version,
    projectionId: "projection-writer-1",
    planId: "plan-1",
    directiveId: "directive-form-1",
    decisionId: "decision-1",
    articulationId: "articulation-1",
    declaration: "Attribution séparée",
    location: {
      excerpt: "Chaque archive nomme une chronologie différente.",
    },
    status: "declared",
    createdAt: new Date().toISOString(),
  });

  return { unit, projection, trace };
}

function validOutput() {
  return {
    criterionResults: [
      {
        criterionId: "criterion-1",
        decisionId: "decision-1",
        articulationId: "articulation-1",
        directiveIds: ["directive-content-1", "directive-form-1"],
        traceIds: ["trace-1"],
        status: "effective",
        contentScore: 8,
        formScore: 8,
        contentFindings: ["Les deux versions ne sont pas fusionnées."],
        formFindings: ["Chaque régime documentaire reste identifiable."],
        evidence: [
          { excerpt: "Chaque archive nomme une chronologie différente." },
        ],
        unintendedEffects: [],
      },
    ],
    contentFormCoherence: 8,
    overallEditorialScore: 8,
    summary: "La relation contenu-forme est effective.",
  };
}

describe("EditorialEffectEvaluator", () => {
  it("normalizes exact textual evidence and preserves provenance", async () => {
    const { unit, projection, trace } = fixture();
    const evaluation = await new EditorialEffectEvaluator(
      new MockClient(validOutput())
    ).evaluate({
      unit,
      projection,
      transformationTraces: [trace],
    });

    expect(evaluation.projectionId).toBe(projection.id);
    expect(evaluation.criterionResults[0].traceIds).toEqual([trace.id]);
    expect(evaluation.criterionResults[0].evidence[0]).toEqual({
      excerpt: "Chaque archive nomme une chronologie différente.",
      start: 0,
      end: "Chaque archive nomme une chronologie différente.".length,
    });
  });

  it("distinguishes an absent operation from an ineffective present operation", async () => {
    const { unit, projection } = fixture();
    const output = validOutput();
    output.criterionResults[0] = {
      ...output.criterionResults[0],
      traceIds: [],
      status: "absent",
      contentScore: 0,
      formScore: 0,
      evidence: [],
      suggestedRepair: "Attribuer explicitement les deux versions.",
    };

    const evaluation = await new EditorialEffectEvaluator(
      new MockClient(output)
    ).evaluate({ unit, projection, transformationTraces: [] });

    expect(evaluation.criterionResults[0].status).toBe("absent");
  });

  it("rejects an excerpt invented by the judge", async () => {
    const { unit, projection, trace } = fixture();
    const output = validOutput();
    output.criterionResults[0].evidence = [
      { excerpt: "Cet extrait n'existe pas dans le texte." },
    ];

    await expect(
      new EditorialEffectEvaluator(new MockClient(output)).evaluate({
        unit,
        projection,
        transformationTraces: [trace],
      })
    ).rejects.toThrow("absent from unit");
  });

  it("rejects a trace that does not belong to the criterion", async () => {
    const { unit, projection, trace } = fixture();
    const foreignTrace = TransformationTraceSchema.parse({
      ...trace,
      id: "trace-foreign",
      directiveId: "directive-foreign",
    });
    const unitWithTrace = {
      ...unit,
      transformationTraceIds: [foreignTrace.id],
    };
    const output = validOutput();
    output.criterionResults[0].traceIds = [foreignTrace.id];

    await expect(
      new EditorialEffectEvaluator(new MockClient(output)).evaluate({
        unit: unitWithTrace,
        projection,
        transformationTraces: [foreignTrace],
      })
    ).rejects.toThrow("does not belong to criterion");
  });
});
