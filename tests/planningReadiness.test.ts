import { describe, expect, it } from "vitest";
import {
  assessPlanningReadiness,
  closePlanningGrill,
  createManuscript,
  createPlanningBrief,
  isPlanningGrillExhausted,
  selectPlanningGrillQuestions,
  type PlanningQuestionCandidate,
} from "../src/domain/index.js";

function readyBrief() {
  const manuscript = createManuscript({
    projectId: "project-1",
    title: "Essay",
  });
  const brief = createPlanningBrief({
    manuscript,
    scopeRef: {
      kind: "manuscript",
      projectId: manuscript.projectId,
      manuscriptId: manuscript.id,
    },
    question: "What does the corpus allow this book to test?",
    hypotheses: [
      {
        statement: "The archive changes the framing",
        status: "supported",
        sourceRefs: ["source-1"],
      },
    ],
    sourceRefs: ["source-1"],
  });
  return brief;
}

const questions: PlanningQuestionCandidate[] = [
  {
    id: "q-1",
    prompt: "Should the argument be chronological or thematic?",
    impact: "structure",
    wouldChangePlanning: true,
  },
  {
    id: "q-2",
    prompt: "Should hypothesis B remain open?",
    impact: "hypothesis",
    wouldChangePlanning: true,
  },
  {
    id: "q-3",
    prompt: "Do we need a primary source before stabilising this branch?",
    impact: "documentary_dependency",
    wouldChangePlanning: true,
  },
  {
    id: "q-4",
    prompt: "Would you like a different adjective in the working title?",
    impact: "scope_meaning",
    wouldChangePlanning: false,
  },
];

describe("planning readiness", () => {
  it("is deterministic and ready when the local scope has enough information", () => {
    const brief = readyBrief();
    const context = {
      relevantPassageCount: 2,
      openAuthorDecisions: [],
      blockingSourceGaps: [],
      canJustifyDecomposition: true,
    };

    expect(assessPlanningReadiness(brief, context)).toEqual(
      assessPlanningReadiness(brief, context)
    );
    expect(assessPlanningReadiness(brief, context)).toEqual({
      ready: true,
      reasons: [],
      authorDecisionNeeded: false,
      blockedBySources: false,
    });
  });

  it("identifies an author decision without opening any implicit loop", () => {
    const assessment = assessPlanningReadiness(readyBrief(), {
      openAuthorDecisions: ["Choose between thematic and chronological structure"],
      canJustifyDecomposition: true,
    });

    expect(assessment.ready).toBe(false);
    expect(assessment.authorDecisionNeeded).toBe(true);
    expect(assessment.reasons).toContain(
      "author decision required: Choose between thematic and chronological structure"
    );
  });

  it("allows a non-blocking local gap without making the whole scope unready", () => {
    const manuscript = createManuscript({ projectId: "project-1", title: "Essay" });
    const brief = createPlanningBrief({
      manuscript,
      scopeRef: {
        kind: "manuscript",
        projectId: manuscript.projectId,
        manuscriptId: manuscript.id,
      },
      question: "Question",
      hypotheses: [
        {
          statement: "Supported direction",
          status: "supported",
          sourceRefs: ["source-1"],
        },
      ],
      gaps: [
        {
          description: "One comparison is still missing",
          consequence: "That local comparison cannot yet be asserted",
        },
      ],
      sourceRefs: ["source-1"],
    });

    const assessment = assessPlanningReadiness(brief, {
      canJustifyDecomposition: true,
      blockingSourceGaps: [],
    });

    expect(assessment.ready).toBe(true);
    expect(assessment.blockedBySources).toBe(false);
  });

  it("distinguishes a scope-level documentary block", () => {
    const assessment = assessPlanningReadiness(readyBrief(), {
      blockingSourceGaps: ["Primary archive required before stabilisation"],
      canJustifyDecomposition: true,
    });

    expect(assessment.ready).toBe(false);
    expect(assessment.blockedBySources).toBe(true);
    expect(assessment.reasons[0]).toContain("blocking documentary gap");
  });
});

describe("bounded planning grill", () => {
  it("selects only discriminating questions and respects the per-round budget", () => {
    const selected = selectPlanningGrillQuestions(questions, 0, {
      maxRounds: 2,
      maxQuestionsPerRound: 2,
    });

    expect(selected.map((question) => question.id)).toEqual(["q-1", "q-2"]);
  });

  it("cannot continue after the configured round budget", () => {
    const policy = { maxRounds: 2 as const, maxQuestionsPerRound: 3 as const };

    expect(isPlanningGrillExhausted(2, policy)).toBe(true);
    expect(selectPlanningGrillQuestions(questions, 2, policy)).toEqual([]);
  });

  it("closes on the best current brief and exposes unresolved material instead of inventing answers", () => {
    const brief = readyBrief();
    const outcome = closePlanningGrill(brief, questions, 2, {
      maxRounds: 2,
      maxQuestionsPerRound: 3,
    });

    expect(outcome.brief).toBe(brief);
    expect(outcome.exhausted).toBe(true);
    expect(outcome.unresolvedQuestions).toEqual([
      "Should the argument be chronological or thematic?",
      "Should hypothesis B remain open?",
      "Do we need a primary source before stabilising this branch?",
    ]);
  });
});
