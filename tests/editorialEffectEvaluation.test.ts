import { describe, expect, it } from "vitest";
import { createEmptyEvaluation } from "../src/domain/evaluation";
import {
  EditorialEffectEvaluationSchema,
  createIntegratedEvaluation,
} from "../src/domain/editorialEffectEvaluation";

function essayEvaluation(scores: {
  claimSupport: number;
  citationIntegrity: number;
  scopeControl: number;
  verdict?: "keep" | "keep_with_minor_edits" | "revise" | "discard";
}) {
  const base = createEmptyEvaluation("judge");
  return {
    ...base,
    overallScore: 8,
    dimensions: {
      ...base.dimensions,
      claimSupport: scores.claimSupport,
      citationIntegrity: scores.citationIntegrity,
      scopeControl: scores.scopeControl,
      counterargumentQuality: 8,
      transitionClarity: 8,
      voiceConsistency: 8,
    },
    verdict: scores.verdict ?? ("keep" as const),
  };
}

function editorialEvaluation(status: "effective" | "harmful" = "effective") {
  return EditorialEffectEvaluationSchema.parse({
    id: "editorial-eval-1",
    unitId: "unit-1",
    unitVersion: 1,
    projectionId: "projection-evaluator-1",
    planId: "plan-1",
    criterionResults: [
      {
        criterionId: "criterion-1",
        decisionId: "decision-1",
        articulationId: "articulation-1",
        directiveIds: ["directive-1"],
        traceIds: [],
        status,
        contentScore: status === "effective" ? 9 : 2,
        formScore: status === "effective" ? 9 : 1,
        contentFindings: ["Le traitement du contenu reste distinct."],
        formFindings: ["Les voix documentaires sont séparées."],
        evidence: [{ excerpt: "Les voix restent distinctes.", start: 0, end: 29 }],
        unintendedEffects: status === "harmful" ? ["Opposition théâtralisée"] : [],
        suggestedRepair:
          status === "effective" ? undefined : "Réduire le contraste formel.",
      },
    ],
    contentFormCoherence: status === "effective" ? 9 : 2,
    overallEditorialScore: status === "effective" ? 9 : 2,
    summary: "Évaluation éditoriale.",
    evaluatedAt: new Date().toISOString(),
    evaluatorModel: "editorial-judge",
  });
}

describe("IntegratedEvaluation", () => {
  it("does not let editorial success compensate documentary failure", () => {
    const integrated = createIntegratedEvaluation(
      essayEvaluation({ claimSupport: 4, citationIntegrity: 4, scopeControl: 8 }),
      editorialEvaluation("effective")
    );

    expect(integrated.gates.documentaryIntegrity).toBe("fail");
    expect(integrated.gates.editorialCoherence).toBe("pass");
    expect(integrated.finalVerdict).toBe("revise");
  });

  it("requires editorial coherence when it is assessed", () => {
    const integrated = createIntegratedEvaluation(
      essayEvaluation({ claimSupport: 8, citationIntegrity: 8, scopeControl: 8 }),
      editorialEvaluation("harmful")
    );

    expect(integrated.gates.documentaryIntegrity).toBe("pass");
    expect(integrated.gates.editorialCoherence).toBe("fail");
    expect(integrated.finalVerdict).toBe("revise");
  });

  it("preserves the historical verdict when no editorial projection is assessed", () => {
    const integrated = createIntegratedEvaluation(
      essayEvaluation({ claimSupport: 8, citationIntegrity: 8, scopeControl: 8 })
    );

    expect(integrated.gates.editorialCoherence).toBe("not_assessed");
    expect(integrated.finalVerdict).toBe("keep");
  });
});
