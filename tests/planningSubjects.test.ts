import { describe, expect, it } from "vitest";
import {
  createManuscript,
} from "../src/domain/index.js";
import {
  createPlanningBriefFromSubject,
  deriveDocumentaryStatus,
  proposePlanningSubjects,
  type CorpusExplorationSnapshot,
  type PlanningEvidenceRef,
} from "../src/editorial/index.js";

const snapshot: CorpusExplorationSnapshot = {
  registeredSourceCount: 4,
  exploredSourceIds: ["s1", "s2"],
  explorationComplete: false,
  passages: [
    { id: "p1", sourceId: "s1", text: "Archive institutions classify populations.", locator: "p. 12" },
    { id: "p2", sourceId: "s2", text: "The category is disputed by later actors.", locator: "p. 44" },
  ],
};

function rawOutput() {
  return {
    axes: [
      {
        label: "Classification",
        question: "How do institutions produce categories?",
        rationale: "The passages connect institutional practice and contested naming.",
        evidence: [{ passageId: "p1", role: "supports" }],
        limits: ["Only half of the registered sources were explored."],
      },
    ],
    subjects: [
      {
        title: "Making categories",
        question: "How are categories made and contested?",
        angle: "Follow institutional production and later contestation.",
        hypotheses: ["Institutional practice stabilizes categories before they are contested."],
        distinctiveness: "Treats classification as a process rather than a fixed vocabulary.",
        evidence: [
          { passageId: "p1", role: "supports" },
          { passageId: "p2", role: "context" },
        ],
        limits: ["The corpus remains partially explored."],
      },
      {
        title: "Contested names",
        question: "When do inherited categories become unstable?",
        angle: "Start from later contestation and work backward.",
        hypotheses: ["Contestation reveals the institutional history of a category."],
        distinctiveness: "Reverses the chronology of the first proposal.",
        evidence: [{ passageId: "p2", role: "contests" }],
        limits: [],
      },
    ],
  };
}

describe("Plan V2 corpus subject exploration", () => {
  it("uses one structured-model call and keeps partial coverage explicit", async () => {
    let calls = 0;
    const client = {
      async generateJson() {
        calls += 1;
        return rawOutput();
      },
    };

    const result = await proposePlanningSubjects(snapshot, client, "Study the politics of classification");

    expect(calls).toBe(1);
    expect(result.coverage).toEqual({
      registeredSourceCount: 4,
      exploredSourceCount: 2,
      explorationComplete: false,
    });
    expect(result.axes[0]?.status).toBe("emergent");
    expect(result.subjects[0]?.status).toBe("emergent");
    expect(result.subjects[1]?.status).toBe("contested");
    expect(result.subjects[0]?.evidence[0]).toMatchObject({
      passageId: "p1",
      sourceId: "s1",
    });
  });

  it("derives documentary status from observed evidence and coverage", () => {
    const support: PlanningEvidenceRef[] = [
      { passageId: "p1", sourceId: "s1", role: "supports" },
    ];
    const mixed: PlanningEvidenceRef[] = [
      ...support,
      { passageId: "p2", sourceId: "s2", role: "contests" },
    ];
    const contextOnly: PlanningEvidenceRef[] = [
      { passageId: "p2", sourceId: "s2", role: "context" },
    ];

    expect(deriveDocumentaryStatus(support, false)).toBe("emergent");
    expect(deriveDocumentaryStatus(support, true)).toBe("supported");
    expect(deriveDocumentaryStatus(mixed, true)).toBe("contested");
    expect(deriveDocumentaryStatus(contextOnly, true)).toBe("under_documented");
  });

  it("rejects model evidence that is not present in the exploration snapshot", async () => {
    const output = rawOutput();
    output.subjects[0]!.evidence = [{ passageId: "hallucinated", role: "supports" }];

    await expect(
      proposePlanningSubjects(snapshot, { generateJson: async () => output })
    ).rejects.toThrow("unknown passage 'hallucinated'");
  });

  it("can turn a chosen proposal into a manuscript PlanningBrief without stabilizing a thesis", async () => {
    const result = await proposePlanningSubjects(snapshot, {
      generateJson: async () => rawOutput(),
    });
    const manuscript = createManuscript({ projectId: "project-1", title: "Essay" });
    const brief = createPlanningBriefFromSubject({
      manuscript,
      scopeRef: {
        kind: "manuscript",
        projectId: manuscript.projectId,
        manuscriptId: manuscript.id,
      },
      subject: result.subjects[0]!,
    });

    expect(brief.question).toBe("How are categories made and contested?");
    expect(brief.hypotheses).toHaveLength(1);
    expect(brief.hypotheses[0]?.status).toBe("emergent");
    expect(brief.sourceRefs).toEqual(["s1", "s2"]);
  });
});
