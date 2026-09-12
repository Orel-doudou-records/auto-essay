import { describe, expect, it } from "vitest";
import {
  DraftUnitSchema,
  ManuscriptSchema,
  type DraftUnit,
  type Manuscript,
} from "@auto-essay/core";
import { makeTempDataDir } from "./helper.js";
import { putWorkspace } from "../src/services/editorialWorkspaceStore.js";
import { getUnit, setUnits } from "../src/services/unitStore.js";
import { createFileCollaborativeCoreStore } from "../src/services/collaborativeCoreStore.js";
import {
  acceptCollaborativeParagraphRevision,
  captureCollaborativeRevisionSource,
  createCollaborativeParagraphRevision,
  rejectCollaborativeParagraphRevision,
} from "../src/services/collaborativeRevisionWork.js";
import { loadCollaborativeRevisionWork } from "../src/services/collaborativeRevisionWorkStore.js";

const createdAt = "2026-09-12T08:00:00.000Z";

function fixture(): { manuscript: Manuscript; unit: DraftUnit } {
  const unit = DraftUnitSchema.parse({
    id: "unit-1",
    projectId: "project-1",
    granularity: "paragraph",
    targetWordCount: 180,
    evidencePack: { sourceIds: [] },
    content: "Canonical paragraph.",
    claimIds: [],
    citationUses: [],
    appliedDecisionIds: [],
    appliedArticulationIds: [],
    transformationTraceIds: [],
    status: "drafting",
    version: 3,
    createdAt,
    updatedAt: createdAt,
  });
  const manuscript = ManuscriptSchema.parse({
    id: "manuscript-1",
    projectId: "project-1",
    title: "Essay",
    tree: [
      {
        kind: "node",
        id: "chapter-1",
        title: "Chapter",
        children: [
          {
            kind: "node",
            id: "section-1",
            title: "Section",
            plan: [
              {
                id: "paragraph-1",
                subject: "Paragraph",
                unitId: "unit-1",
                unitVersion: 3,
                notes: [],
              },
            ],
            children: [{ kind: "leaf", unitId: "unit-1", version: 3 }],
          },
        ],
      },
    ],
    createdAt,
    updatedAt: createdAt,
  });
  return { manuscript, unit };
}

async function seed(dataDir: string): Promise<void> {
  process.env.AUTO_ESSAY_DATA_DIR = dataDir;
  const source = fixture();
  await setUnits("project-1", [source.unit]);
  await putWorkspace("project-1", {
    manuscript: source.manuscript,
    distribution: [],
    profiles: [],
    articulations: [],
  });
}

async function createWork(proposedContent = "Revised paragraph candidate.") {
  const source = await captureCollaborativeRevisionSource("project-1", "unit-1");
  expect(source.authority).toBe("collaborative-core");
  if (source.authority !== "collaborative-core") throw new Error("expected collaborative source");
  const result = await createCollaborativeParagraphRevision({
    projectId: "project-1",
    source,
    proposedContent,
  });
  expect(result.status).toBe("created");
  if (result.status !== "created") throw new Error("expected created work");
  return result.work;
}

describe("AE2 collaborative Proposal/Review commands", () => {
  it("accepts unchanged work by creating and reviewing a Proposal without another Revision", async () => {
    const dataDir = makeTempDataDir();
    await seed(dataDir);
    const work = await createWork();

    const result = await acceptCollaborativeParagraphRevision({
      projectId: "project-1",
      unitId: "unit-1",
      workId: work.id,
      content: work.proposedContent,
    });

    expect(result.status).toBe("accepted");
    expect(result.authorRevisionCreated).toBe(false);
    expect(result.work.headRevisionId).toBe(work.headRevisionId);
    expect(result.work.proposalId).toBe(result.proposal.id);
    expect(result.proposal.status).toBe("approved");
    expect(result.proposal.items).toHaveLength(1);
    expect(result.proposal.reviewDecisions).toHaveLength(1);
    expect(result.proposal.reviewDecisions[0]).toMatchObject({
      reviewer: { id: "autoessay:author" },
      decision: "accept",
      authorized: true,
    });

    const store = createFileCollaborativeCoreStore("project-1", { dataDir });
    const link = await store.loadProjectLink();
    expect(await store.loadProposal(link!.coreProjectId, result.proposal.id)).toEqual(result.proposal);
    expect(await store.loadReviewDecisions(link!.coreProjectId, result.proposal.id)).toEqual(
      result.proposal.reviewDecisions
    );
    expect(await getUnit("project-1", "unit-1")).toMatchObject({
      content: "Canonical paragraph.",
      version: 3,
    });
  });

  it("records an author-authored workspace Revision before accepting edited content", async () => {
    const dataDir = makeTempDataDir();
    await seed(dataDir);
    const work = await createWork();

    const result = await acceptCollaborativeParagraphRevision({
      projectId: "project-1",
      unitId: "unit-1",
      workId: work.id,
      content: "Author-edited paragraph.",
    });

    expect(result.authorRevisionCreated).toBe(true);
    expect(result.work.headRevisionId).not.toBe(work.headRevisionId);
    expect(result.work.proposedContent).toBe("Author-edited paragraph.");
    expect(result.proposal.status).toBe("approved");
    expect(result.proposal.items.map((item) => item.sourceRevisionId)).toEqual([
      work.headRevisionId,
      result.work.headRevisionId,
    ]);
    expect(result.proposal.provenanceRefs).toEqual(
      expect.arrayContaining([
        { kind: "source_revision", id: work.headRevisionId },
        { kind: "source_revision", id: result.work.headRevisionId },
      ])
    );

    const store = createFileCollaborativeCoreStore("project-1", { dataDir });
    const link = await store.loadProjectLink();
    const graph = await store.loadRevisionGraph(link!.coreProjectId);
    expect(graph?.revisions[result.work.headRevisionId]).toMatchObject({
      branchId: work.workspaceId,
      parentIds: [work.headRevisionId],
      author: { id: "autoessay:author" },
    });
    const manuscript = await store.loadCurrentManuscript(link!.coreProjectId, work.workspaceId);
    const node = manuscript?.nodes[work.literaryNodeId];
    const content = await store.resolveContentVersion(
      link!.coreProjectId,
      result.work.headRevisionId,
      work.literaryNodeId,
      node!.contentRef!.version
    );
    expect(content?.content).toBe("Author-edited paragraph.");
    expect(await getUnit("project-1", "unit-1")).toMatchObject({
      content: "Canonical paragraph.",
      version: 3,
    });
  });

  it("rejects work through Proposal/Review while preserving the workspace and canonical content", async () => {
    const dataDir = makeTempDataDir();
    await seed(dataDir);
    const work = await createWork();

    const result = await rejectCollaborativeParagraphRevision({
      projectId: "project-1",
      unitId: "unit-1",
      workId: work.id,
    });

    expect(result.status).toBe("rejected");
    expect(result.work.status).toBe("rejected");
    expect(result.work.proposalId).toBe(result.proposal.id);
    expect(result.proposal.status).toBe("rejected");
    expect(result.proposal.reviewDecisions).toHaveLength(1);
    expect(result.proposal.reviewDecisions[0]).toMatchObject({
      reviewer: { id: "autoessay:author" },
      decision: "reject",
      authorized: true,
    });

    const store = createFileCollaborativeCoreStore("project-1", { dataDir });
    const link = await store.loadProjectLink();
    const graph = await store.loadRevisionGraph(link!.coreProjectId);
    expect(graph?.branches[work.workspaceId]?.headRevisionId).toBe(work.headRevisionId);
    expect(await store.loadProposal(link!.coreProjectId, result.proposal.id)).toEqual(result.proposal);
    expect(await store.loadReviewDecisions(link!.coreProjectId, result.proposal.id)).toEqual(
      result.proposal.reviewDecisions
    );
    expect(await getUnit("project-1", "unit-1")).toMatchObject({
      content: "Canonical paragraph.",
      version: 3,
    });
  });

  it("makes repeated reject idempotent for the same terminal review", async () => {
    const dataDir = makeTempDataDir();
    await seed(dataDir);
    const work = await createWork();
    const first = await rejectCollaborativeParagraphRevision({
      projectId: "project-1",
      unitId: "unit-1",
      workId: work.id,
    });
    const second = await rejectCollaborativeParagraphRevision({
      projectId: "project-1",
      unitId: "unit-1",
      workId: work.id,
    });

    expect(second).toEqual(first);
    const store = createFileCollaborativeCoreStore("project-1", { dataDir });
    const link = await store.loadProjectLink();
    expect(await store.loadReviewDecisions(link!.coreProjectId, first.proposal.id)).toHaveLength(1);
  });

  it("rejects a work/unit scope mismatch server-side", async () => {
    const dataDir = makeTempDataDir();
    await seed(dataDir);
    const work = await createWork();

    await expect(
      acceptCollaborativeParagraphRevision({
        projectId: "project-1",
        unitId: "other-unit",
        workId: work.id,
        content: work.proposedContent,
      })
    ).rejects.toThrow("collaborative revision work scope mismatch");

    expect(await loadCollaborativeRevisionWork("project-1", work.id)).toEqual(work);
  });
});
