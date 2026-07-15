import { describe, expect, it } from "vitest";
import { createContentStyleArticulation } from "../src/domain/contentStyleArticulation";
import {
  createEditorialDecision,
  isEditorialDecisionExecutable,
} from "../src/domain/editorialDecision";
import {
  createEditorialPlan,
  isEditorialPlanExecutable,
} from "../src/domain/editorialPlan";

function makeArticulation(status: "candidate" | "accepted" | "modified") {
  const articulation = createContentStyleArticulation({
    scope: {
      level: "paragraph",
      projectId: "project-1",
      sectionId: "section-1",
      paragraphId: "paragraph-1",
    },
    contentRelationIds: ["relation-1"],
    stylisticOperations: [
      {
        family: "enunciation_structure",
        category: "claim_attribution",
        operation: "attribute each chronology to its source",
        target: "source_voice",
        rationale: "keep documentary regimes distinct",
      },
    ],
    intendedEffects: {
      content: ["preserve the two chronologies"],
      form: ["differentiate the source voices"],
      epistemic: ["avoid presenting one source as neutral"],
    },
    origin: "co_constructed",
  });

  return { ...articulation, status };
}

describe("EditorialDecision", () => {
  it("should reject a candidate articulation", () => {
    const articulation = makeArticulation("candidate");

    expect(() =>
      createEditorialDecision(articulation, {
        projectId: "project-1",
        contentCommitments: ["keep both chronologies distinct"],
        formalCommitments: ["attribute each chronology explicitly"],
      })
    ).toThrow();
  });

  it("should create a versioned active decision from an accepted articulation", () => {
    const articulation = makeArticulation("accepted");
    const decision = createEditorialDecision(articulation, {
      projectId: "project-1",
      version: 2,
      contentCommitments: ["keep both chronologies distinct"],
      formalCommitments: ["attribute each chronology explicitly"],
      invariants: ["do not change claim confidence"],
      prohibitedShortcuts: ["do not merge the sources into a neutral synthesis"],
      validationNote: "Accepted after narrowing the scope to paragraph 1.",
      supersedesDecisionId: "decision-v1",
    });

    expect(decision.version).toBe(2);
    expect(decision.status).toBe("active");
    expect(decision.validation.validatedBy).toBe("author");
    expect(decision.articulationId).toBe(articulation.id);
    expect(isEditorialDecisionExecutable(decision)).toBe(true);
  });

  it("should treat revoked or superseded decisions as non-executable", () => {
    const articulation = makeArticulation("modified");
    const decision = createEditorialDecision(articulation, {
      projectId: "project-1",
      contentCommitments: ["preserve the contradiction"],
      formalCommitments: ["avoid a smoothing transition"],
    });

    expect(isEditorialDecisionExecutable({ ...decision, status: "revoked" })).toBe(false);
    expect(isEditorialDecisionExecutable({ ...decision, status: "superseded" })).toBe(false);
  });
});

describe("EditorialPlan", () => {
  it("should derive decision and articulation references from active decisions", () => {
    const articulation = makeArticulation("accepted");
    const decision = createEditorialDecision(articulation, {
      projectId: "project-1",
      contentCommitments: ["keep both chronologies distinct"],
      formalCommitments: ["attribute each chronology explicitly"],
    });

    const plan = createEditorialPlan({
      unitId: "unit-1",
      unitVersion: 1,
      scope: articulation.scope,
      argumentativeFunction: "introduce the documentary disagreement",
      decisions: [decision],
      claimIds: ["claim-1", "claim-2"],
      evidenceIds: ["annotation-1", "annotation-2"],
      sourceRelationIds: ["relation-1"],
      contentOperations: ["present both chronologies without resolving them"],
      stylisticOperations: articulation.stylisticOperations,
      intendedEffects: articulation.intendedEffects,
      invariants: ["preserve source attribution"],
      status: "validated",
    });

    expect(plan.decisionIds).toEqual([decision.id]);
    expect(plan.articulationIds).toEqual([articulation.id]);
    expect(isEditorialPlanExecutable(plan)).toBe(true);
  });

  it("should reject a plan containing a revoked decision", () => {
    const articulation = makeArticulation("accepted");
    const decision = createEditorialDecision(articulation, {
      projectId: "project-1",
      contentCommitments: ["keep both chronologies distinct"],
      formalCommitments: ["attribute each chronology explicitly"],
    });

    expect(() =>
      createEditorialPlan({
        unitId: "unit-1",
        unitVersion: 1,
        scope: articulation.scope,
        argumentativeFunction: "introduce the documentary disagreement",
        decisions: [{ ...decision, status: "revoked" }],
        contentOperations: ["present both chronologies"],
        stylisticOperations: articulation.stylisticOperations,
        intendedEffects: articulation.intendedEffects,
      })
    ).toThrow();
  });
});
