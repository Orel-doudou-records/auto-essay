import { describe, expect, it } from "vitest";
import {
  PlanningBriefSchema,
  createManuscript,
  createManuscriptNode,
  createPlanEntry,
  createPlanningBrief,
  isPlanningScopeResolvable,
  supersedePlanningBrief,
} from "../src/domain/index.js";

function manuscriptFixture() {
  const paragraph = createPlanEntry("A planned paragraph");
  const chapter = createManuscriptNode({
    id: "chapter-1",
    title: "Chapter 1",
    plan: [paragraph],
  });
  const manuscript = createManuscript({
    projectId: "project-1",
    title: "Essay",
    tree: [chapter],
  });
  return { manuscript, paragraph };
}

describe("PlanningBrief", () => {
  it("creates a v1 brief for an existing manuscript node with embedded values", () => {
    const { manuscript } = manuscriptFixture();
    const brief = createPlanningBrief({
      manuscript,
      scopeRef: {
        kind: "node",
        projectId: manuscript.projectId,
        manuscriptId: manuscript.id,
        nodeId: "chapter-1",
      },
      question: "What does this chapter test?",
      hypotheses: [
        {
          statement: "The archive changes the argument",
          status: "emergent",
          sourceRefs: ["source-1"],
        },
      ],
      gaps: [
        {
          description: "Primary testimony is missing",
          consequence: "The causal claim cannot be stabilized",
          neededEvidence: "Primary source",
        },
      ],
      sourceRefs: ["source-1"],
    });

    expect(brief.version).toBe(1);
    expect(brief.supersedesBriefId).toBeUndefined();
    expect(brief.scopeRef.kind).toBe("node");
    expect(brief.hypotheses[0]?.status).toBe("emergent");
    expect(brief.gaps).toHaveLength(1);
  });

  it("addresses a planned paragraph before a DraftUnit exists", () => {
    const { manuscript, paragraph } = manuscriptFixture();
    const scopeRef = {
      kind: "plan_entry" as const,
      projectId: manuscript.projectId,
      manuscriptId: manuscript.id,
      planEntryId: paragraph.id,
    };

    expect(isPlanningScopeResolvable(manuscript, scopeRef)).toBe(true);
    expect(
      createPlanningBrief({ manuscript, scopeRef, question: "What should this paragraph do?" })
        .scopeRef
    ).toEqual(scopeRef);
  });

  it("rejects an unknown or cross-project scope", () => {
    const { manuscript } = manuscriptFixture();
    expect(() =>
      createPlanningBrief({
        manuscript,
        scopeRef: {
          kind: "node",
          projectId: manuscript.projectId,
          manuscriptId: manuscript.id,
          nodeId: "missing",
        },
        question: "Unknown?",
      })
    ).toThrow("Unknown planning scope");

    expect(() =>
      createPlanningBrief({
        manuscript,
        scopeRef: {
          kind: "manuscript",
          projectId: "another-project",
          manuscriptId: manuscript.id,
        },
        question: "Wrong project?",
      })
    ).toThrow("Planning scope project does not match manuscript project");
  });

  it("supersedes immutably and advances exactly one version", () => {
    const { manuscript } = manuscriptFixture();
    const first = createPlanningBrief({
      manuscript,
      scopeRef: {
        kind: "manuscript",
        projectId: manuscript.projectId,
        manuscriptId: manuscript.id,
      },
      question: "Initial question",
    });
    const second = supersedePlanningBrief(first, manuscript, {
      question: "Refined question",
    });

    expect(first.version).toBe(1);
    expect(first.question).toBe("Initial question");
    expect(second.version).toBe(2);
    expect(second.question).toBe("Refined question");
    expect(second.supersedesBriefId).toBe(first.id);
    expect(second.id).not.toBe(first.id);
  });

  it("rejects invalid version lineage and unsupported hypothesis status", () => {
    const { manuscript } = manuscriptFixture();
    const base = createPlanningBrief({
      manuscript,
      scopeRef: {
        kind: "manuscript",
        projectId: manuscript.projectId,
        manuscriptId: manuscript.id,
      },
      question: "Question",
    });

    expect(
      PlanningBriefSchema.safeParse({ ...base, version: 2, supersedesBriefId: undefined }).success
    ).toBe(false);
    expect(
      PlanningBriefSchema.safeParse({
        ...base,
        hypotheses: [{ statement: "Guess", status: "certain", sourceRefs: [] }],
      }).success
    ).toBe(false);
  });
});
