import { describe, expect, it } from "vitest";
import {
  compilePlanningScopeToEditorialPlan,
  createManuscript,
  createManuscriptNode,
  createPlanningBrief,
} from "../src/index.js";
import type { EditorialDecision } from "../src/domain/editorialDecision.js";

function activeDecision(projectId: string): EditorialDecision {
  const now = new Date().toISOString();
  return {
    id: "decision-1",
    projectId,
    version: 1,
    scope: {
      level: "section",
      projectId,
      sectionId: "chapter-1",
    },
    articulationId: "articulation-1",
    contentCommitments: ["Keep the archival tension explicit"],
    formalCommitments: ["Use attributed source voices"],
    invariants: [],
    prohibitedShortcuts: [],
    validation: {
      validatedBy: "author",
      validatedAt: now,
    },
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
}

function fixture() {
  const chapter = createManuscriptNode({ id: "chapter-1", title: "Archive regimes" });
  const manuscript = createManuscript({
    projectId: "project-1",
    title: "Essay",
    tree: [chapter],
  });
  const brief = createPlanningBrief({
    manuscript,
    scopeRef: {
      kind: "node",
      projectId: manuscript.projectId,
      manuscriptId: manuscript.id,
      nodeId: "chapter-1",
    },
    question: "How do institutional and counter-archives compete?",
    angleOrFunction: "Confront two documentary regimes without collapsing them",
    hypotheses: [
      {
        statement: "Institutional archives stabilize an official memory",
        status: "supported",
        sourceRefs: ["source-1"],
      },
      {
        statement: "Counter-archives reorganize that memory",
        status: "under_documented",
        sourceRefs: ["source-2"],
      },
    ],
    gaps: [
      {
        description: "Counter-archive testimony remains partial",
        consequence: "The second hypothesis must remain provisional",
        neededEvidence: "additional first-person testimony",
      },
    ],
    constraints: ["Do not merge institutional and vernacular evidence"],
    sourceRefs: ["source-1", "source-2"],
  });

  const execution = {
    unitId: "unit-1",
    unitVersion: 1,
    scope: {
      level: "section" as const,
      projectId: manuscript.projectId,
      sectionId: "chapter-1",
    },
    decisions: [activeDecision(manuscript.projectId)],
    claimIds: ["claim-1"],
    evidenceIds: ["evidence-1"],
    sourceRelationIds: ["relation-neighbor-1"],
    contentOperations: ["Confront the two documentary regimes"],
    stylisticOperations: [
      {
        family: "enunciation_structure" as const,
        category: "source_distance" as const,
        operation: "Keep source voices explicitly attributed",
        target: "source_voice" as const,
        rationale: "Preserve epistemic distinctions between archives",
        intensity: "structuring" as const,
      },
    ],
    intendedEffects: {
      content: ["Keep documentary disagreement visible"],
      form: ["Separate source voices"],
      argumentative: ["Prevent premature synthesis"],
    },
    inheritedConstraints: ["Preserve chronology where evidence depends on it"],
  };

  return { manuscript, brief, execution };
}

describe("planning -> EditorialPlan compiler", () => {
  it("compiles a locally ready scope into the existing EditorialPlan", () => {
    const { brief, execution } = fixture();
    const result = compilePlanningScopeToEditorialPlan({
      brief,
      readinessContext: {
        parentRoleKnown: true,
        relevantPassageCount: 2,
      },
      passageProvenance: [
        { passageId: "passage-1", sourceId: "source-1" },
        { passageId: "passage-2", sourceId: "source-2" },
      ],
      execution,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.argumentativeFunction).toBe(brief.angleOrFunction);
    expect(result.plan.evidenceIds).toEqual(["evidence-1"]);
    expect(result.plan.sourceRelationIds).toEqual(["relation-neighbor-1"]);
    expect(result.plan.invariants).toEqual([
      "Do not merge institutional and vernacular evidence",
      "Preserve chronology where evidence depends on it",
    ]);
    expect(result.trace.briefId).toBe(brief.id);
    expect(result.trace.hypotheses[1]?.status).toBe("under_documented");
    expect(result.trace.passageProvenance).toEqual([
      { passageId: "passage-1", sourceId: "source-1" },
      { passageId: "passage-2", sourceId: "source-2" },
    ]);
  });

  it("does not require global or parent readiness to compile the local scope", () => {
    const { brief, execution } = fixture();
    const result = compilePlanningScopeToEditorialPlan({
      brief,
      readinessContext: {
        parentRoleKnown: true,
        relevantPassageCount: 1,
      },
      execution,
    });
    expect(result.ok).toBe(true);
  });

  it("reuses readiness to refuse a critical documentary block", () => {
    const { brief, execution } = fixture();
    const result = compilePlanningScopeToEditorialPlan({
      brief,
      readinessContext: {
        parentRoleKnown: true,
        relevantPassageCount: 1,
        blockingSourceGaps: ["missing primary testimony for the central comparison"],
      },
      execution,
    });
    expect(result).toEqual({
      ok: false,
      reasons: [
        "blocking documentary gap: missing primary testimony for the central comparison",
      ],
    });
  });

  it("keeps a non-critical planning gap visible without copying it into EditorialPlan", () => {
    const { brief, execution } = fixture();
    const result = compilePlanningScopeToEditorialPlan({
      brief,
      readinessContext: {
        parentRoleKnown: true,
        relevantPassageCount: 1,
      },
      execution,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.trace.nonBlockingGaps).toHaveLength(1);
    expect(result.trace.nonBlockingGaps[0]?.description).toContain("Counter-archive");
    expect("gaps" in result.plan).toBe(false);
    expect("hypotheses" in result.plan).toBe(false);
    expect("sourceRefs" in result.plan).toBe(false);
  });

  it("rejects passage provenance detached from the brief corpus", () => {
    const { brief, execution } = fixture();
    const result = compilePlanningScopeToEditorialPlan({
      brief,
      readinessContext: {
        parentRoleKnown: true,
        relevantPassageCount: 1,
      },
      passageProvenance: [{ passageId: "passage-x", sourceId: "source-x" }],
      execution,
    });

    expect(result).toEqual({
      ok: false,
      reasons: [
        "passage passage-x references source source-x outside the planning brief",
      ],
    });
  });
});
