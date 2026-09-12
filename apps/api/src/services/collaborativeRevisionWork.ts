import { createHash } from "node:crypto";
import {
  projectAutoEssayManuscriptToCollaborativeCore,
  type DraftUnit,
  type Manuscript,
} from "@auto-essay/core";
import {
  commitChangeSet,
  createChangeSet,
  createWorkBranch,
  persistCommit,
} from "writing-engine";
import { getWorkspace } from "./editorialWorkspaceStore.js";
import { withProjectWriteLock } from "./projectWriteLock.js";
import { listUnits } from "./unitStore.js";
import {
  createFileCollaborativeCoreStore,
  type AutoEssayCanonicalFingerprint,
} from "./collaborativeCoreStore.js";
import { synchronizeAutoEssayCanonicalWhileLocked } from "./collaborativeCoreCanonicalSync.js";
import {
  CollaborativeRevisionWorkDtoSchema,
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
