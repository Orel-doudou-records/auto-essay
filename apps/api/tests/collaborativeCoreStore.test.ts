import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DraftUnitSchema,
  ManuscriptSchema,
  type DraftUnit,
  type Manuscript,
} from "@auto-essay/core";
import {
  IntegrationSchema,
  ProposalSchema,
  ReviewDecisionSchema,
  createChangeSet,
  createRevisionGraph,
} from "writing-engine";
import { makeTempDataDir } from "./helper.js";
import {
  bootstrapAutoEssayCollaborativeCore,
  createFileCollaborativeCoreStore,
  type IntegrationMaterializationReceipt,
} from "../src/services/collaborativeCoreStore.js";

const createdAt = "2026-09-12T00:00:00.000Z";

function paragraphFixture(): { manuscript: Manuscript; units: DraftUnit[] } {
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
  return { manuscript, units: [unit] };
}

describe("AE2 file-backed CollaborativeCoreStore", () => {
  it("bootstraps once from the #168 projection and survives a store restart", async () => {
    const dataDir = makeTempDataDir();
    const source = paragraphFixture();
    const sourceSnapshot = structuredClone(source);
    const store = createFileCollaborativeCoreStore("project-1", { dataDir });

    const first = await bootstrapAutoEssayCollaborativeCore({
      autoEssayProjectId: "project-1",
      manuscript: source.manuscript,
      draftUnits: source.units,
      store,
    });
    const second = await bootstrapAutoEssayCollaborativeCore({
      autoEssayProjectId: "project-1",
      manuscript: source.manuscript,
      draftUnits: source.units,
      store,
    });

    expect(second).toEqual(first);
    expect(first.projectLink).toEqual({
      autoEssayProjectId: "project-1",
      coreProjectId: "autoessay:project-1",
      canonicalBranchId: "canonical",
    });
    expect(first.graph.branches[first.graph.canonicalBranchId]?.canonical).toBe(true);
    expect(first.manuscript.nodes["paragraph-1"]).toMatchObject({
      id: "paragraph-1",
      kind: "paragraph",
      contentRef: { nodeId: "paragraph-1", version: 3 },
    });
    expect(first.projectionLinks).toEqual([
      expect.objectContaining({
        literaryNodeId: "paragraph-1",
        autoEssay: {
          unitId: "unit-1",
          unitVersion: 3,
          contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
        coreContentVersion: { nodeId: "paragraph-1", version: 3 },
        coreRevisionId: first.graph.branches[first.graph.canonicalBranchId]!.headRevisionId,
      }),
    ]);
    expect(source).toEqual(sourceSnapshot);

    const restarted = createFileCollaborativeCoreStore("project-1", { dataDir });
    expect(await restarted.loadRevisionGraph(first.projectLink.coreProjectId)).toEqual(first.graph);
    expect(await restarted.loadProjectLink()).toEqual(first.projectLink);
    expect(await restarted.listProjectionLinks()).toEqual(first.projectionLinks);
    expect(
      await restarted.loadSnapshot(
        first.projectLink.coreProjectId,
        first.graph.branches[first.graph.canonicalBranchId]!.headRevisionId
      )
    ).toMatchObject({ manuscript: first.manuscript });

    const files = await fs.readdir(path.join(dataDir, "project-1"));
    expect(files).toContain("collaborative-core");
    expect(files).not.toContain("revision-proposals.json");
  });

  it("enforces branch-head CAS and round-trips collaborative review state and receipts", async () => {
    const dataDir = makeTempDataDir();
    const source = paragraphFixture();
    const store = createFileCollaborativeCoreStore("project-1", { dataDir });
    const bootstrapped = await bootstrapAutoEssayCollaborativeCore({
      autoEssayProjectId: "project-1",
      manuscript: source.manuscript,
      draftUnits: source.units,
      store,
    });
    const graph = bootstrapped.graph;
    const head = graph.branches[graph.canonicalBranchId]!.headRevisionId;

    await expect(
      store.advanceBranchHead({
        projectId: bootstrapped.projectLink.coreProjectId,
        branchId: graph.canonicalBranchId,
        expectedHeadRevisionId: "stale-head",
        nextHeadRevisionId: head,
      })
    ).rejects.toThrow(/branch head mismatch/i);

    const proposal = ProposalSchema.parse({
      id: "proposal-1",
      projectId: bootstrapped.projectLink.coreProjectId,
      sourceBranchId: graph.canonicalBranchId,
      sourceHeadRevisionId: head,
      baseRevisionId: head,
      proposer: { id: "autoessay:author" },
      status: "submitted",
      items: [
        {
          id: "item-1",
          sourceRevisionId: head,
          changeSetId: graph.revisions[head]!.changeSetId,
          changeIndex: 0,
        },
      ],
      reviewDecisions: [],
      provenanceRefs: [],
      createdAt,
      submittedAt: createdAt,
    });
    const review = ReviewDecisionSchema.parse({
      id: "review-1",
      proposalId: proposal.id,
      itemId: "item-1",
      reviewer: { id: "autoessay:author" },
      decision: "accept",
      authorized: true,
      createdAt,
    });
    const integration = IntegrationSchema.parse({
      id: "integration-1",
      proposalId: proposal.id,
      revisionId: head,
      acceptedItemIds: ["item-1"],
      rejectedItemIds: [],
      decisionIds: [review.id],
      integrator: { id: "autoessay:author" },
      provenanceRefs: [],
      createdAt,
    });
    const receipt: IntegrationMaterializationReceipt = {
      id: "receipt-1",
      projectId: "project-1",
      proposalId: proposal.id,
      integrationId: integration.id,
      coreRevisionId: head,
      unitId: "unit-1",
      expectedSource: bootstrapped.projectionLinks[0]!.autoEssay,
      targetVersion: 4,
      targetContentHash: "a".repeat(64),
      status: "prepared",
      createdAt,
    };

    await store.saveProposal(proposal);
    await store.appendReviewDecisions(bootstrapped.projectLink.coreProjectId, [review]);
    await store.saveIntegration(bootstrapped.projectLink.coreProjectId, integration);
    await store.saveMaterializationReceipt(receipt);

    const restarted = createFileCollaborativeCoreStore("project-1", { dataDir });
    expect(await restarted.loadProposal(bootstrapped.projectLink.coreProjectId, proposal.id)).toEqual(proposal);
    expect(await restarted.loadReviewDecisions(bootstrapped.projectLink.coreProjectId, proposal.id)).toEqual([review]);
    expect(await restarted.loadIntegration(bootstrapped.projectLink.coreProjectId, integration.id)).toEqual(integration);
    expect(await restarted.loadMaterializationReceipt(receipt.id)).toEqual(receipt);
  });

  it("keeps initial content versions addressable from the bootstrap revision", async () => {
    const dataDir = makeTempDataDir();
    const source = paragraphFixture();
    const store = createFileCollaborativeCoreStore("project-1", { dataDir });
    const result = await bootstrapAutoEssayCollaborativeCore({
      autoEssayProjectId: "project-1",
      manuscript: source.manuscript,
      draftUnits: source.units,
      store,
    });
    const head = result.graph.branches[result.graph.canonicalBranchId]!.headRevisionId;

    const content = await store.resolveContentVersion(
      result.projectLink.coreProjectId,
      head,
      "paragraph-1",
      3
    );

    expect(content).toMatchObject({
      nodeId: "paragraph-1",
      version: 3,
      content: "Canonical paragraph.",
    });
  });
});
