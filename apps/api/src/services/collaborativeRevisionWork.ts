import { createHash } from "node:crypto";
import {
  projectAutoEssayManuscriptToCollaborativeCore,
  type DraftUnit,
  type Manuscript,
} from "@auto-essay/core";
import {
  commitChangeSet,
  createChangeSet,
  createProposal,
  createWorkBranch,
  persistCommit,
  reviewProposalSelection,
  submitProposal,
  type Proposal,
  type RevisionGraph,
} from "writing-engine";
import { getWorkspace } from "./editorialWorkspaceStore.js";
import { withProjectWriteLock } from "./projectWriteLock.js";
import { listUnits } from "./unitStore.js";
import {
  createFileCollaborativeCoreStore,
  type AutoEssayCanonicalFingerprint,
  type AutoEssayCollaborativeCoreStore,
} from "./collaborativeCoreStore.js";
import { synchronizeAutoEssayCanonicalWhileLocked } from "./collaborativeCoreCanonicalSync.js";
import {
  CollaborativeRevisionWorkDtoSchema,
  loadCollaborativeRevisionWork,
  saveCollaborativeRevisionWork,
  type CollaborativeRevisionWorkDto,
} from "./collaborativeRevisionWorkStore.js";

export type RevisionAuthority = "legacy" | "collaborative-core";

export function resolveRevisionAuthority(input: {
  unit: DraftUnit;
  literaryNodeId?: string;
}): RevisionAuthority {
  return input.unit.granularity === "paragraph" && input.literaryNodeId !== undefined
    ? "collaborative-core"
    : "legacy";
}

export type CollaborativeRevisionSource = {
  authority: "collaborative-core";
  projectId: string;
  unitId: string;
  literaryNodeId: string;
  fingerprint: AutoEssayCanonicalFingerprint;
  content: string;
};

export type LegacyRevisionSource = {
  authority: "legacy";
  projectId: string;
  unitId: string;
};

export type CapturedRevisionSource = CollaborativeRevisionSource | LegacyRevisionSource;

export type CreateCollaborativeParagraphRevisionInput = {
  projectId: string;
  source: CollaborativeRevisionSource;
  proposedContent: string;
};

export type CreateCollaborativeParagraphRevisionResult =
  | {
      status: "created";
      work: CollaborativeRevisionWorkDto;
    }
  | {
      status: "candidate_stale_before_workspace";
    }
  | {
      status: "unsupported_projection_drift";
      reason: string;
    };

export type AcceptCollaborativeParagraphRevisionInput = {
  projectId: string;
  unitId: string;
  workId: string;
  content: string;
};

export type AcceptCollaborativeParagraphRevisionResult = {
  status: "accepted";
  work: CollaborativeRevisionWorkDto;
  proposal: Proposal;
  authorRevisionCreated: boolean;
};

export type RejectCollaborativeParagraphRevisionInput = {
  projectId: string;
  unitId: string;
  workId: string;
};

export type RejectCollaborativeParagraphRevisionResult = {
  status: "rejected";
  work: CollaborativeRevisionWorkDto;
  proposal: Proposal;
};

function contentHash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function fingerprint(unit: DraftUnit): AutoEssayCanonicalFingerprint {
  return {
    unitId: unit.id,
    unitVersion: unit.version,
    contentHash: contentHash(unit.content),
  };
}

function sameFingerprint(
  left: AutoEssayCanonicalFingerprint,
  right: AutoEssayCanonicalFingerprint
): boolean {
  return (
    left.unitId === right.unitId &&
    left.unitVersion === right.unitVersion &&
    left.contentHash === right.contentHash
  );
}

function resolveLiteraryNodeId(
  manuscript: Manuscript,
  draftUnits: DraftUnit[],
  unitId: string
): string | undefined {
  const projected = projectAutoEssayManuscriptToCollaborativeCore({
    manuscript,
    draftUnits,
    contentCreatedBy: { id: "autoessay-authority-resolution" },
  });

  const matches = Object.values(projected.manuscript.nodes).filter(
    (node) =>
      !node.removed &&
      node.domainRefs.some(
        (ref) => ref.kind === "autoessay.draft-unit" && ref.id === unitId
      )
  );
  if (matches.length > 1) {
    throw new Error(`DraftUnit '${unitId}' resolves to multiple literary identities`);
  }
  return matches[0]?.id;
}

function requireWorkScope(
  work: CollaborativeRevisionWorkDto | undefined,
  input: { projectId: string; unitId: string; workId: string }
): CollaborativeRevisionWorkDto {
  if (work === undefined) {
    throw new Error(`collaborative revision work not found: ${input.workId}`);
  }
  if (
    work.id !== input.workId ||
    work.projectId !== input.projectId ||
    work.unitId !== input.unitId
  ) {
    throw new Error("collaborative revision work scope mismatch");
  }
  return work;
}

function collectWorkspaceRevisionIds(
  graph: RevisionGraph,
  work: CollaborativeRevisionWorkDto
): string[] {
  const reversed: string[] = [];
  const seen = new Set<string>();
  let cursor = work.headRevisionId;

  while (cursor !== work.baseRevisionId) {
    if (seen.has(cursor)) {
      throw new Error(`revision cycle detected while building Proposal: ${cursor}`);
    }
    seen.add(cursor);
    const revision = graph.revisions[cursor];
    if (revision === undefined) {
      throw new Error(`workspace revision not found: ${cursor}`);
    }
    if (revision.branchId !== work.workspaceId) {
      throw new Error("workspace history escaped the collaborative revision scope");
    }
    reversed.push(revision.id);
    const parent = revision.parentIds[0];
    if (parent === undefined) {
      throw new Error("workspace base is not an ancestor of the current head");
    }
    cursor = parent;
  }

  return reversed.reverse();
}

function proposalItemsForWorkspace(
  graph: RevisionGraph,
  work: CollaborativeRevisionWorkDto,
  proposalId: string
) {
  const revisionIds = collectWorkspaceRevisionIds(graph, work);
  const items = revisionIds.flatMap((revisionId) => {
    const revision = graph.revisions[revisionId]!;
    const changeSet = graph.changeSets[revision.changeSetId];
    if (changeSet === undefined) {
      throw new Error(`workspace ChangeSet not found: ${revision.changeSetId}`);
    }
    return changeSet.changes.map((_, changeIndex) => ({
      id: `${proposalId}:item:${revisionId}:${changeIndex}`,
      sourceRevisionId: revisionId,
      changeIndex,
    }));
  });
  if (items.length === 0) {
    throw new Error("collaborative revision workspace has no changes to propose");
  }
  return { revisionIds, items };
}

async function createAndReviewProposal(input: {
  store: AutoEssayCollaborativeCoreStore;
  coreProjectId: string;
  graph: RevisionGraph;
  work: CollaborativeRevisionWorkDto;
  decision: "accept" | "reject";
}): Promise<Proposal> {
  const proposalId = `${input.work.id}:proposal`;
  const { revisionIds, items } = proposalItemsForWorkspace(
    input.graph,
    input.work,
    proposalId
  );
  const now = new Date().toISOString();
  const draft = createProposal({
    graph: input.graph,
    id: proposalId,
    projectId: input.coreProjectId,
    sourceBranchId: input.work.workspaceId,
    sourceHeadRevisionId: input.work.headRevisionId,
    baseRevisionId: input.work.baseRevisionId,
    proposer: { id: "autoessay:author" },
    createdAt: now,
    items,
    provenanceRefs: [
      { kind: "autoessay.revise-chat", id: input.work.id },
      { kind: "autoessay.draft-unit", id: input.work.unitId },
      ...revisionIds.map((id) => ({ kind: "source_revision", id })),
    ],
  });
  const submitted = submitProposal(draft, { submittedAt: now });
  const reviewed = reviewProposalSelection(submitted, {
    itemIds: submitted.items.map((item) => item.id),
    decision: input.decision,
    reviewer: { id: "autoessay:author" },
    authorized: true,
    decisionIdPrefix: `${proposalId}:author-${input.decision}`,
    createdAt: now,
  });

  await input.store.saveProposal(reviewed);
  await input.store.appendReviewDecisions(
    input.coreProjectId,
    reviewed.reviewDecisions
  );
  return reviewed;
}

function proposalIsTerminalAuthorReject(proposal: Proposal): boolean {
  return (
    proposal.status === "rejected" &&
    proposal.items.every((item) =>
      proposal.reviewDecisions.some(
        (decision) =>
          decision.itemId === item.id &&
          decision.reviewer.id === "autoessay:author" &&
          decision.authorized &&
          decision.decision === "reject"
      )
    )
  );
}

async function loadCollaborativeContext(
  store: AutoEssayCollaborativeCoreStore,
  work: CollaborativeRevisionWorkDto
): Promise<{ coreProjectId: string; graph: RevisionGraph }> {
  const projectLink = await store.loadProjectLink();
  if (projectLink === undefined) {
    throw new Error("collaborative project link is missing");
  }
  const graph = await store.loadRevisionGraph(projectLink.coreProjectId);
  if (graph === undefined) {
    throw new Error("collaborative revision graph is missing");
  }
  const branch = graph.branches[work.workspaceId];
  if (branch === undefined || branch.canonical) {
    throw new Error("collaborative revision workspace is missing");
  }
  if (branch.headRevisionId !== work.headRevisionId) {
    throw new Error("collaborative revision work head does not match workspace head");
  }
  return { coreProjectId: projectLink.coreProjectId, graph };
}

export async function captureCollaborativeRevisionSource(
  projectId: string,
  unitId: string
): Promise<CapturedRevisionSource> {
  return withProjectWriteLock(projectId, async () => {
    const [workspace, draftUnits] = await Promise.all([
      getWorkspace(projectId),
      listUnits(projectId),
    ]);
    const unit = draftUnits.find((candidate) => candidate.id === unitId);
    if (unit === undefined) throw new Error("unit not found");
    const literaryNodeId = resolveLiteraryNodeId(
      workspace.manuscript,
      draftUnits,
      unitId
    );
    const authority = resolveRevisionAuthority({ unit, literaryNodeId });
    if (authority === "legacy" || literaryNodeId === undefined) {
      return { authority: "legacy", projectId, unitId };
    }
    return {
      authority,
      projectId,
      unitId,
      literaryNodeId,
      fingerprint: fingerprint(unit),
      content: unit.content,
    };
  });
}

export async function createCollaborativeParagraphRevision(
  input: CreateCollaborativeParagraphRevisionInput
): Promise<CreateCollaborativeParagraphRevisionResult> {
  if (input.source.projectId !== input.projectId) {
    throw new Error("captured revision source belongs to another project");
  }

  return withProjectWriteLock(input.projectId, async () => {
    const [workspace, draftUnits] = await Promise.all([
      getWorkspace(input.projectId),
      listUnits(input.projectId),
    ]);
    const currentUnit = draftUnits.find((unit) => unit.id === input.source.unitId);
    if (
      currentUnit === undefined ||
      !sameFingerprint(fingerprint(currentUnit), input.source.fingerprint)
    ) {
      return { status: "candidate_stale_before_workspace" };
    }

    const currentLiteraryNodeId = resolveLiteraryNodeId(
      workspace.manuscript,
      draftUnits,
      currentUnit.id
    );
    if (
      resolveRevisionAuthority({
        unit: currentUnit,
        literaryNodeId: currentLiteraryNodeId,
      }) !== "collaborative-core" ||
      currentLiteraryNodeId !== input.source.literaryNodeId
    ) {
      return { status: "candidate_stale_before_workspace" };
    }

    const store = createFileCollaborativeCoreStore(input.projectId);
    const sync = await synchronizeAutoEssayCanonicalWhileLocked({
      autoEssayProjectId: input.projectId,
      manuscript: workspace.manuscript,
      draftUnits,
      store,
    });
    if (sync.status === "unsupported_projection_drift") {
      return {
        status: "unsupported_projection_drift",
        reason: sync.reason,
      };
    }

    const projectLink = await store.loadProjectLink();
    if (projectLink === undefined) {
      throw new Error("collaborative project link is missing after canonical synchronization");
    }
    const graph = await store.loadRevisionGraph(projectLink.coreProjectId);
    if (graph === undefined) {
      throw new Error("collaborative revision graph is missing after canonical synchronization");
    }
    const canonicalBranch = graph.branches[projectLink.canonicalBranchId];
    if (canonicalBranch === undefined || !canonicalBranch.canonical) {
      throw new Error("canonical CC1 branch is missing");
    }
    const baseRevisionId = canonicalBranch.headRevisionId;
    const canonicalManuscript = await store.loadCurrentManuscript(
      projectLink.coreProjectId,
      projectLink.canonicalBranchId
    );
    if (canonicalManuscript === undefined) {
      throw new Error("canonical CC1 manuscript snapshot is missing");
    }
    const node = canonicalManuscript.nodes[input.source.literaryNodeId];
    if (
      node === undefined ||
      node.removed ||
      node.kind !== "paragraph" ||
      node.contentRef === undefined
    ) {
      throw new Error("eligible paragraph literary node is unavailable after synchronization");
    }
    const projectionLink = await store.loadProjectionLink(node.id);
    if (
      projectionLink === undefined ||
      !sameFingerprint(projectionLink.autoEssay, input.source.fingerprint)
    ) {
      throw new Error("canonical projection fingerprint changed during synchronization");
    }

    const workId = `revision-work:${crypto.randomUUID()}`;
    const workspaceId = `workspace:${workId}`;
    const revisionId = `${workId}:candidate`;
    const graphWithWorkspace = createWorkBranch(graph, {
      id: workspaceId,
      kind: "workspace",
      fromRevisionId: baseRevisionId,
    });
    const changeSet = createChangeSet({
      id: `${workId}:changes`,
      changes: [
        {
          kind: "replace_content",
          baseRevisionId,
          nodeId: node.id,
          expectedContentVersion: node.contentRef,
          content: input.proposedContent,
        },
      ],
    });
    const createdAt = new Date().toISOString();
    const commit = commitChangeSet({
      graph: graphWithWorkspace,
      manuscript: canonicalManuscript,
      branchId: workspaceId,
      revisionId,
      expectedHeadRevisionId: baseRevisionId,
      changeSet,
      author: { id: "autoessay:revision-agent" },
      createdAt,
      message: "Create revise-chat working revision",
      provenanceRefs: [
        { kind: "autoessay.revise-chat", id: workId },
        { kind: "autoessay.draft-unit", id: input.source.unitId },
      ],
    });

    await persistCommit(store, {
      projectId: projectLink.coreProjectId,
      expectedHeadRevisionId: baseRevisionId,
      commit,
    });

    const work = CollaborativeRevisionWorkDtoSchema.parse({
      id: workId,
      projectId: input.projectId,
      unitId: input.source.unitId,
      literaryNodeId: node.id,
      workspaceId,
      baseRevisionId,
      headRevisionId: revisionId,
      base: {
        ...input.source.fingerprint,
        content: input.source.content,
      },
      proposedContent: input.proposedContent,
      status: "working",
    });
    await saveCollaborativeRevisionWork(work);

    return { status: "created", work };
  });
}

export async function acceptCollaborativeParagraphRevision(
  input: AcceptCollaborativeParagraphRevisionInput
): Promise<AcceptCollaborativeParagraphRevisionResult> {
  return withProjectWriteLock(input.projectId, async () => {
    let work = requireWorkScope(
      await loadCollaborativeRevisionWork(input.projectId, input.workId),
      input
    );
    if (work.status !== "working" || work.proposalId !== undefined) {
      throw new Error("collaborative revision work is already reviewed");
    }

    const store = createFileCollaborativeCoreStore(input.projectId);
    const context = await loadCollaborativeContext(store, work);
    const coreProjectId = context.coreProjectId;
    let graph = context.graph;
    const workspaceManuscript = await store.loadCurrentManuscript(
      coreProjectId,
      work.workspaceId
    );
    if (workspaceManuscript === undefined) {
      throw new Error("collaborative workspace snapshot is missing");
    }
    const node = workspaceManuscript.nodes[work.literaryNodeId];
    if (
      node === undefined ||
      node.removed ||
      node.kind !== "paragraph" ||
      node.contentRef === undefined
    ) {
      throw new Error("collaborative paragraph is unavailable in the workspace");
    }
    const currentContent = await store.resolveContentVersion(
      coreProjectId,
      work.headRevisionId,
      work.literaryNodeId,
      node.contentRef.version
    );
    if (currentContent === undefined) {
      throw new Error("collaborative paragraph content is unavailable in the workspace");
    }

    let authorRevisionCreated = false;
    if (currentContent.content !== input.content) {
      const previousHeadRevisionId = work.headRevisionId;
      const revisionId = `${work.id}:author-edit:${crypto.randomUUID()}`;
      const changeSet = createChangeSet({
        id: `${revisionId}:changes`,
        changes: [
          {
            kind: "replace_content",
            baseRevisionId: previousHeadRevisionId,
            nodeId: work.literaryNodeId,
            expectedContentVersion: node.contentRef,
            content: input.content,
          },
        ],
      });
      const commit = commitChangeSet({
        graph,
        manuscript: workspaceManuscript,
        branchId: work.workspaceId,
        revisionId,
        expectedHeadRevisionId: previousHeadRevisionId,
        changeSet,
        author: { id: "autoessay:author" },
        createdAt: new Date().toISOString(),
        message: "Record author-edited revise-chat content",
        provenanceRefs: [
          { kind: "autoessay.revise-chat", id: work.id },
          { kind: "autoessay.draft-unit", id: work.unitId },
        ],
      });
      await persistCommit(store, {
        projectId: coreProjectId,
        expectedHeadRevisionId: previousHeadRevisionId,
        commit,
      });
      graph = commit.graph;
      work = CollaborativeRevisionWorkDtoSchema.parse({
        ...work,
        headRevisionId: revisionId,
        proposedContent: input.content,
      });
      await saveCollaborativeRevisionWork(work);
      authorRevisionCreated = true;
    }

    const proposal = await createAndReviewProposal({
      store,
      coreProjectId,
      graph,
      work,
      decision: "accept",
    });
    work = CollaborativeRevisionWorkDtoSchema.parse({
      ...work,
      proposalId: proposal.id,
    });
    await saveCollaborativeRevisionWork(work);

    return {
      status: "accepted",
      work,
      proposal,
      authorRevisionCreated,
    };
  });
}

export async function rejectCollaborativeParagraphRevision(
  input: RejectCollaborativeParagraphRevisionInput
): Promise<RejectCollaborativeParagraphRevisionResult> {
  return withProjectWriteLock(input.projectId, async () => {
    let work = requireWorkScope(
      await loadCollaborativeRevisionWork(input.projectId, input.workId),
      input
    );
    const store = createFileCollaborativeCoreStore(input.projectId);

    if (work.status === "rejected" && work.proposalId !== undefined) {
      const projectLink = await store.loadProjectLink();
      if (projectLink === undefined) {
        throw new Error("collaborative project link is missing");
      }
      const existingProposal = await store.loadProposal(
        projectLink.coreProjectId,
        work.proposalId
      );
      if (
        existingProposal !== undefined &&
        proposalIsTerminalAuthorReject(existingProposal)
      ) {
        return { status: "rejected", work, proposal: existingProposal };
      }
    }
    if (work.status !== "working" || work.proposalId !== undefined) {
      throw new Error("collaborative revision work is already reviewed");
    }

    const { coreProjectId, graph } = await loadCollaborativeContext(store, work);
    const proposal = await createAndReviewProposal({
      store,
      coreProjectId,
      graph,
      work,
      decision: "reject",
    });
    work = CollaborativeRevisionWorkDtoSchema.parse({
      ...work,
      status: "rejected",
      proposalId: proposal.id,
    });
    await saveCollaborativeRevisionWork(work);

    return { status: "rejected", work, proposal };
  });
}
