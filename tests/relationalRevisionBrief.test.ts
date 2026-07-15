import { describe, expect, it } from "vitest";
import { createDraftUnit } from "../src/domain/draftUnit";
import { createEmptyEvaluation } from "../src/domain/evaluation";
import { EditorialEffectEvaluationSchema } from "../src/domain/editorialEffectEvaluation";
import { RevisionEditorialProjectionSchema } from "../src/domain/editorialProjection";
import { RevisionBriefGenerator } from "../src/revision/genBrief";

function fixture() {
  const unit = createDraftUnit({
    projectId: "project-1",
    granularity: "paragraph",
    content: "Chaque source propose une chronologie. La transition les fusionne pourtant.",
    claimIds: ["claim-1", "claim-2"],
    editorialPlanId: "plan-1",
    appliedDecisionIds: ["decision-1"],
    appliedArticulationIds: ["articulation-1"],
  });
  const projection = RevisionEditorialProjectionSchema.parse({
    id: "projection-revision-1",
    type: "revision",
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
    preserve: ["conserver les niveaux de confiance"],
    avoid: ["ne pas résoudre artificiellement la contradiction"],
    repairDirectives: [
      {
        id: "directive-content-1",
        decisionId: "decision-1",
        articulationId: "articulation-1",
        kind: "content",
        instruction: "maintenir les deux claims distincts",
      },
      {
        id: "directive-form-1",
        decisionId: "decision-1",
        articulationId: "articulation-1",
        kind: "form",
        instruction: "attribuer chaque version avant la transition",
      },
    ],
  });
  const editorialEvaluation = EditorialEffectEvaluationSchema.parse({
    id: "editorial-eval-1",
    unitId: unit.id,
    unitVersion: unit.version,
    projectionId: "projection-evaluator-1",
    planId: "plan-1",
    criterionResults: [
      {
        criterionId: "criterion-1",
        decisionId: "decision-1",
        articulationId: "articulation-1",
        directiveIds: ["directive-content-1", "directive-form-1"],
        traceIds: [],
        status: "present_ineffective",
        contentScore: 4,
        formScore: 3,
        contentFindings: ["La transition fusionne les chronologies."],
        formFindings: ["L'attribution disparaît au point de jonction."],
        evidence: [
          {
            excerpt: "La transition les fusionne pourtant.",
            start: 39,
            end: 75,
          },
        ],
        unintendedEffects: ["Fausse synthèse"],
        suggestedRepair:
          "Rétablir l'attribution de chaque source dans la transition.",
      },
    ],
    contentFormCoherence: 4,
    overallEditorialScore: 4,
    summary: "La décision est visible mais inefficace.",
    evaluatedAt: new Date().toISOString(),
    evaluatorModel: "editorial-judge",
  });
  const essayEvaluation = {
    ...createEmptyEvaluation("judge"),
    overallScore: 7,
    dimensions: {
      claimSupport: 7,
      citationIntegrity: 7,
      counterargumentQuality: 7,
      transitionClarity: 5,
      scopeControl: 7,
      voiceConsistency: 6,
    },
    verdict: "revise" as const,
  };

  return { unit, projection, editorialEvaluation, essayEvaluation };
}

describe("RevisionBriefGenerator relational mode", () => {
  it("turns a failed effect into a traceable repair instruction", () => {
    const { unit, projection, editorialEvaluation, essayEvaluation } = fixture();
    const brief = new RevisionBriefGenerator().generateBrief(
      essayEvaluation,
      unit,
      {
        projection,
        editorialEvaluation,
        sourceEvaluationId: "essay-eval-1",
      }
    );

    expect(brief.sourceEditorialEvaluationId).toBe(editorialEvaluation.id);
    expect(brief.editorialProjectionId).toBe(projection.id);
    expect(brief.relationalInstructions).toHaveLength(1);
    expect(brief.relationalInstructions[0]).toEqual(
      expect.objectContaining({
        decisionId: "decision-1",
        articulationId: "articulation-1",
        criterionId: "criterion-1",
        priority: 1,
        protectedClaimIds: ["claim-1", "claim-2"],
      })
    );
    expect(brief.preserveInvariants).toContain(
      "conserver les niveaux de confiance"
    );
    expect(brief.prohibitedChanges).toContain(
      "Ne modifier aucun claim, niveau de confiance ou attribution sans réévaluation documentaire."
    );
  });

  it("keeps historical brief generation compatible", () => {
    const { unit, essayEvaluation } = fixture();
    const brief = new RevisionBriefGenerator().generateBrief(
      essayEvaluation,
      unit
    );

    expect(brief.relationalInstructions).toEqual([]);
    expect(brief.editorialProjectionId).toBeUndefined();
    expect(brief.protectedClaimIds).toEqual([]);
  });

  it("rejects a revision projection from another plan", () => {
    const { unit, projection, editorialEvaluation, essayEvaluation } = fixture();

    expect(() =>
      new RevisionBriefGenerator().generateBrief(essayEvaluation, unit, {
        projection: { ...projection, planId: "plan-foreign" },
        editorialEvaluation,
      })
    ).toThrow("plan provenance is inconsistent");
  });
});
