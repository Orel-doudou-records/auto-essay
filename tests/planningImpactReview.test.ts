import { describe, expect, it } from "vitest";
import {
  compilePlanningScopeToEditorialPlan,
  createManuscript,
  createManuscriptNode,
  createPlanningBrief,
  reviewPlanningChangeImpacts,
  supersedePlanningBrief,
} from "../src/index.js";
import type { EditorialDecision } from "../src/domain/editorialDecision.js";
import type { StructuredModelClient } from "../src/evaluation/evaluateEssay.js";

class QueueClient implements StructuredModelClient {
  constructor(private readonly outputs: unknown[]) {}
  async generateJson(): Promise<unknown> {
    if (this.outputs.length === 0) throw new Error("No queued model output");
    return this.outputs.shift();
  }
}

function diffractOutput(overrides: Record<string, unknown> = {}) {
  return {
    pass4: { cut: "review only", included: [], excluded: [], cutOfNonAdoption: [] },
    verdict: "adapt_differently",
    verdictDetail: "targeted review required",
    action: "review impacted scopes",
    tradeoffs: [],
    planImpacts: [],
    bibliographyImpacts: [],
    ...overrides,
  };
}

function activeDecision(projectId: string, sectionId: string): EditorialDecision {
  const now = new Date().toISOString();
  return {
    id: `decision-${sectionId}`,
    projectId,
    version: 1,
    scope: { level: "section", projectId, sectionId },
    articulationId: `articulation-${sectionId}`,
    contentCommitments: ["Keep the documentary tension explicit"],
    formalCommitments: ["Keep source voices attributed"],
    invariants: [],
    prohibitedShortcuts: [],
    validation: { validatedBy: "author", validatedAt: now },
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
}

function fixture() {
  const chapterA = createManuscriptNode({
    id: "chapter-a",
    title: "Archive formation",
    plan: [{ id: "a-1", subject: "Institutional memory" }],
  });
  const chapterB = createManuscriptNode({
    id: "chapter-b",
    title: "Counter-archives",
    plan: [{ id: "b-1", subject: "Vernacular memory" }],
  });
  const manuscript = createManuscript({
    projectId: "project-1",
    title: "Essay",
    tree: [chapterA, chapterB],
  });
  const previousBrief = createPlanningBrief({
    manuscript,
    scopeRef: {
      kind: "node",
      projectId: manuscript.projectId,
      manuscriptId: manuscript.id,
      nodeId: "chapter-a",
    },
    question: "How does the institution stabilize memory?",
    angleOrFunction: "Establish the institutional archive before counter-reading it",
    hypotheses: [
      {
        statement: "Institutional archives stabilize an official memory",
        status: "supported",
        sourceRefs: ["source-1"],
      },
    ],
    sourceRefs: ["source-1"],
    constraints: ["Keep institutional and vernacular evidence distinct"],
  });
  const nextBrief = supersedePlanningBrief(previousBrief, manuscript, {
    question: "How does institutional memory change when counter-archives contradict it?",
    sourceRefs: ["source-1", "source-2"],
    hypotheses: [
      ...previousBrief.hypotheses,
      {
        statement: "Counter-archives destabilize the official narrative",
        status: "contested",
        sourceRefs: ["source-2"],
      },
    ],
  });
  return { manuscript, previousBrief, nextBrief };
}

function compiledScope(
  manuscript: ReturnType<typeof createManuscript>,
  brief: ReturnType<typeof createPlanningBrief>,
  sectionId: string
) {
  const result = compilePlanningScopeToEditorialPlan({
    brief,
    readinessContext: { parentRoleKnown: true, relevantPassageCount: 1 },
    execution: {
      unitId: `unit-${sectionId}`,
      unitVersion: 1,
      scope: { level: "section", projectId: manuscript.projectId, sectionId },
      decisions: [activeDecision(manuscript.projectId, sectionId)],
      argumentativeFunction: brief.angleOrFunction ?? "Execute local argument",
      contentOperations: ["Develop the local argument"],
      stylisticOperations: [
        {
          family: "enunciation_structure",
          category: "source_distance",
          operation: "Keep source voices explicitly attributed",
          target: "source_voice",
          rationale: "Preserve epistemic distinctions",
          intensity: "structuring",
        },
      ],
      intendedEffects: {
        content: ["Keep documentary disagreement visible"],
        form: ["Separate source voices"],
      },
    },
  });
  if (!result.ok) throw new Error(result.reasons.join("; "));
  return { plan: result.plan, trace: result.trace };
}

describe("planning change impact review", () => {
  it("marks an untouched compiled scope as unaffected", async () => {
    const { manuscript, previousBrief, nextBrief } = fixture();
    const otherBrief = createPlanningBrief({
      manuscript,
      scopeRef: {
        kind: "node",
        projectId: manuscript.projectId,
        manuscriptId: manuscript.id,
        nodeId: "chapter-b",
      },
      question: "How do vernacular archives reorganize memory?",
      angleOrFunction: "Test the counter-archive independently",
      hypotheses: [{ statement: "Vernacular archives alter public memory", status: "supported", sourceRefs: ["source-3"] }],
      sourceRefs: ["source-3"],
    });
    const compiled = compiledScope(manuscript, otherBrief, "chapter-b");
    const result = await reviewPlanningChangeImpacts(
      { previousBrief, nextBrief, manuscript, compiledScopes: [compiled] },
      new QueueClient([diffractOutput()])
    );
    expect(result.impacts).toEqual([
      expect.objectContaining({ scopeId: "chapter-b", kind: "unaffected", editorialPlanId: compiled.plan.id }),
    ]);
  });

  it("surfaces a real distant impact directly from existing Diffract planImpacts", async () => {
    const { manuscript, previousBrief, nextBrief } = fixture();
    const result = await reviewPlanningChangeImpacts(
      { previousBrief, nextBrief, manuscript },
      new QueueClient([
        diffractOutput({
          planImpacts: [
            {
              partId: "chapter-b",
              partTitle: "Counter-archives",
              entryId: "b-1",
              impact: "The new contradiction changes how the later vernacular-memory section must frame its claim",
            },
          ],
        }),
      ])
    );
    expect(result.impacts).toEqual([
      expect.objectContaining({
        scopeId: "b-1",
        kind: "review_recommended",
        reason: expect.stringContaining("later vernacular-memory"),
      }),
    ]);
  });

  it("marks an EditorialPlan stale when its compilation trace comes from the superseded brief", async () => {
    const { manuscript, previousBrief, nextBrief } = fixture();
    const compiled = compiledScope(manuscript, previousBrief, "chapter-a");
    const result = await reviewPlanningChangeImpacts(
      { previousBrief, nextBrief, manuscript, compiledScopes: [compiled] },
      new QueueClient([diffractOutput()])
    );
    expect(result.impacts).toEqual([
      expect.objectContaining({
        scopeId: "chapter-a",
        kind: "editorial_plan_stale",
        editorialPlanId: compiled.plan.id,
      }),
    ]);
  });

  it("distinguishes a structural conflict without rewriting anything", async () => {
    const { manuscript, previousBrief, nextBrief } = fixture();
    const compiled = compiledScope(manuscript, previousBrief, "chapter-a");
    const structurallyChanged = createManuscript({
      projectId: manuscript.projectId,
      title: manuscript.title,
      tree: [manuscript.tree[1]!],
    });
    const result = await reviewPlanningChangeImpacts(
      { previousBrief, nextBrief, manuscript: structurallyChanged, compiledScopes: [compiled] },
      new QueueClient([diffractOutput()])
    );
    expect(result.impacts[0]).toEqual(expect.objectContaining({
      scopeId: "chapter-a",
      kind: "structural_conflict",
      editorialPlanId: compiled.plan.id,
    }));
  });

  it("turns a contradictory/new source signal into targeted documentary revalidation", async () => {
    const { manuscript, previousBrief, nextBrief } = fixture();
    const result = await reviewPlanningChangeImpacts(
      { previousBrief, nextBrief, manuscript },
      new QueueClient([
        diffractOutput({
          bibliographyImpacts: [
            {
              sourceId: "source-2",
              scopeId: "chapter-b",
              kind: "rapprocher",
              impact: "The contradictory source weakens the current hypothesis and requires rereading chapter-b",
            },
          ],
        }),
      ])
    );
    expect(result.impacts).toEqual([
      expect.objectContaining({
        scopeId: "chapter-b",
        kind: "source_gap_changed",
        reason: expect.stringContaining("weakens the current hypothesis"),
      }),
    ]);
  });
});
