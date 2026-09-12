import {
  projectAutoEssayManuscriptToCollaborativeCore,
  type DraftUnit,
  type Manuscript,
} from "@auto-essay/core";
import {
  commitChangeSet,
  createChangeSet,
  moveLiteraryNode,
  persistCommit,
  removeLiteraryNode,
  type Change,
  type ContentVersion,
  type LiteraryManuscript,
  type LiteraryNode,
} from "writing-engine";
import { getWorkspace } from "./editorialWorkspaceStore.js";
import { withProjectWriteLock } from "./projectWriteLock.js";
import { listUnits } from "./unitStore.js";
import {
  bootstrapAutoEssayCollaborativeCore,
  createFileCollaborativeCoreStore,
  type AutoEssayCanonicalFingerprint,
  type AutoEssayCollaborativeCoreStore,
  type CanonicalProjectionLink,
} from "./collaborativeCoreStore.js";

export type CanonicalSyncChangeKind = Extract<
  Change["kind"],
  "replace_content" | "move_node" | "remove_node"
>;

export type CanonicalSyncResult =
  | {
      status: "noop";
      coreRevisionId: string;
    }
  | {
      status: "synchronized";
      coreRevisionId: string;
      revisionCreated: boolean;
      changeKinds: CanonicalSyncChangeKind[];
    }
  | {
      status: "unsupported_projection_drift";
      coreRevisionId: string;
      reason: string;
    };

export type SynchronizeAutoEssayCanonicalWhileLockedInput = {
  autoEssayProjectId: string;
  manuscript: Manuscript;
  draftUnits: DraftUnit[];
  store: AutoEssayCollaborativeCoreStore;
};

function unsupported(coreRevisionId: string, reason: string): CanonicalSyncResult {
  return {
    status: "unsupported_projection_drift",
    coreRevisionId,
    reason,
  };
}

function activeNodes(manuscript: LiteraryManuscript): Map<string, LiteraryNode> {
  return new Map(
    Object.values(manuscript.nodes)
      .filter((node) => !node.removed)
      .map((node) => [node.id, node])
  );
}

function draftUnitRef(node: LiteraryNode): string | undefined {
  return node.domainRefs.find((ref) => ref.kind === "autoessay.draft-unit")?.id;
}

function contentByNodeId(contentVersions: ContentVersion[]): Map<string, ContentVersion> {
  const result = new Map<string, ContentVersion>();
  for (const version of contentVersions) {
    if (result.has(version.nodeId)) {
      throw new Error(`duplicate projected ContentVersion for node: ${version.nodeId}`);
    }
    result.set(version.nodeId, version);
  }
  return result;
}

function traversal(manuscript: LiteraryManuscript): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  function visit(nodeId: string): void {
    if (seen.has(nodeId)) throw new Error(`literary tree cycle detected: ${nodeId}`);
    seen.add(nodeId);
    const node = manuscript.nodes[nodeId];
    if (node === undefined || node.removed) return;
    result.push(nodeId);
    for (const childId of node.childIds) visit(childId);
  }

  visit(manuscript.rootId);
  return result;
}

function sameContentRef(
  left: { nodeId: string; version: number } | undefined,
  right: { nodeId: string; version: number } | undefined
): boolean {
  return (
    left?.nodeId === right?.nodeId &&
    left?.version === right?.version
  );
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

function sameProjectionLink(
  left: CanonicalProjectionLink,
  right: CanonicalProjectionLink
): boolean {
  return (
    left.literaryNodeId === right.literaryNodeId &&
    sameFingerprint(left.autoEssay, right.autoEssay) &&
    sameContentRef(left.coreContentVersion, right.coreContentVersion) &&
    left.coreRevisionId === right.coreRevisionId
  );
}

function desiredFingerprint(
  node: LiteraryNode,
  projectedContent: ContentVersion,
  unitsById: Map<string, DraftUnit>
): AutoEssayCanonicalFingerprint | undefined {
  const unitId = draftUnitRef(node);
  if (unitId === undefined) return undefined;
  const unit = unitsById.get(unitId);
  if (unit === undefined) return undefined;
  return {
    unitId,
    unitVersion: unit.version,
    contentHash: projectedContent.contentHash,
  };
}

async function projectCurrentAutoEssayState(
  input: SynchronizeAutoEssayCanonicalWhileLockedInput,
  currentRevisionId: string
): Promise<
  | { ok: true; manuscript: LiteraryManuscript; contentVersions: ContentVersion[] }
  | { ok: false; result: CanonicalSyncResult }
> {
  try {
    return {
      ok: true,
      ...projectAutoEssayManuscriptToCollaborativeCore({
        manuscript: input.manuscript,
        draftUnits: input.draftUnits,
        contentCreatedBy: { id: "autoessay-canonical-sync" },
      }),
    };
  } catch (error) {
    return {
      ok: false,
      result: unsupported(
        currentRevisionId,
        `AutoEssay canonical projection cannot be represented deterministically: ${
          error instanceof Error ? error.message : String(error)
        }`
      ),
    };
  }
}

export async function synchronizeAutoEssayCanonicalWhileLocked(
  input: SynchronizeAutoEssayCanonicalWhileLockedInput
): Promise<CanonicalSyncResult> {
  const bootstrap = await bootstrapAutoEssayCollaborativeCore({
    autoEssayProjectId: input.autoEssayProjectId,
    manuscript: input.manuscript,
    draftUnits: input.draftUnits,
    store: input.store,
  });
  const projectLink = bootstrap.projectLink;
  const graph = await input.store.loadRevisionGraph(projectLink.coreProjectId);
  if (graph === undefined) {
    throw new Error("collaborative project link exists without revision graph");
  }
  const canonical = graph.branches[projectLink.canonicalBranchId];
  if (canonical === undefined || !canonical.canonical) {
    throw new Error("canonical CC1 branch is missing");
  }
  const headRevisionId = canonical.headRevisionId;
  const current = await input.store.loadCurrentManuscript(
    projectLink.coreProjectId,
    projectLink.canonicalBranchId
  );
  if (current === undefined) {
    throw new Error("canonical CC1 manuscript snapshot is missing");
  }

  const projected = await projectCurrentAutoEssayState(input, headRevisionId);
  if (!projected.ok) return projected.result;
  const desired = projected.manuscript;
  if (desired.rootId !== current.rootId) {
    return unsupported(headRevisionId, "canonical manuscript root identity changed");
  }

  const currentActive = activeNodes(current);
  const desiredActive = activeNodes(desired);

  for (const [nodeId, desiredNode] of desiredActive) {
    const currentNode = current.nodes[nodeId];
    if (currentNode === undefined) {
      return unsupported(headRevisionId, `new literary identity is not supported: ${nodeId}`);
    }
    if (currentNode.removed) {
      return unsupported(headRevisionId, `reintroduced literary identity is not supported: ${nodeId}`);
    }
    if (currentNode.kind !== desiredNode.kind) {
      return unsupported(
        headRevisionId,
        `literary node kind changed for ${nodeId}: ${currentNode.kind} -> ${desiredNode.kind}`
      );
    }
    const currentUnitId = draftUnitRef(currentNode);
    const desiredUnitId = draftUnitRef(desiredNode);
    if (currentUnitId !== desiredUnitId) {
      return unsupported(headRevisionId, `DraftUnit identity changed for literary node: ${nodeId}`);
    }
    if ((currentNode.contentRef === undefined) !== (desiredNode.contentRef === undefined)) {
      return unsupported(headRevisionId, `content identity changed for literary node: ${nodeId}`);
    }
  }

  const removedIds = [...currentActive.keys()].filter(
    (nodeId) => !desiredActive.has(nodeId)
  );
  for (const nodeId of removedIds) {
    const node = currentActive.get(nodeId)!;
    if (node.kind === "manuscript" || node.childIds.length > 0) {
      return unsupported(
        headRevisionId,
        `only unambiguous active leaf removal is supported: ${nodeId}`
      );
    }
  }

  const projectedContent = contentByNodeId(projected.contentVersions);
  const unitsById = new Map(input.draftUnits.map((unit) => [unit.id, unit]));
  const linksByNodeId = new Map(
    (await input.store.listProjectionLinks()).map((link) => [link.literaryNodeId, link])
  );

  const contentChanges = new Map<
    string,
    { content: string; fingerprint: AutoEssayCanonicalFingerprint }
  >();
  const desiredFingerprints = new Map<string, AutoEssayCanonicalFingerprint>();

  for (const [nodeId, desiredNode] of desiredActive) {
    if (desiredNode.contentRef === undefined) continue;
    const projectedVersion = projectedContent.get(nodeId);
    if (projectedVersion === undefined) {
      return unsupported(headRevisionId, `projected content is missing for literary node: ${nodeId}`);
    }
    const fingerprint = desiredFingerprint(desiredNode, projectedVersion, unitsById);
    if (fingerprint === undefined) {
      return unsupported(headRevisionId, `canonical DraftUnit is missing for literary node: ${nodeId}`);
    }
    desiredFingerprints.set(nodeId, fingerprint);
    const link = linksByNodeId.get(nodeId);
    if (link === undefined) {
      return unsupported(headRevisionId, `canonical projection link is missing for literary node: ${nodeId}`);
    }
    if (link.autoEssay.unitId !== fingerprint.unitId) {
      return unsupported(headRevisionId, `canonical projection unit identity changed for: ${nodeId}`);
    }
    const currentNode = current.nodes[nodeId]!;
    if (currentNode.contentRef === undefined) {
      return unsupported(headRevisionId, `canonical CC1 content reference is missing for: ${nodeId}`);
    }
    const currentContent = await input.store.resolveContentVersion(
      projectLink.coreProjectId,
      headRevisionId,
      nodeId,
      currentNode.contentRef.version
    );
    if (currentContent === undefined) {
      return unsupported(headRevisionId, `canonical CC1 ContentVersion is missing for: ${nodeId}`);
    }
    if (currentContent.contentHash !== fingerprint.contentHash) {
      contentChanges.set(nodeId, {
        content: projectedVersion.content,
        fingerprint,
      });
    }
  }

  if (removedIds.length > 0 && contentChanges.size > 0) {
    return unsupported(
      headRevisionId,
      "removal combined with content replacement is ambiguous with merge/lineage drift"
    );
  }

  const changes: Change[] = [];
  let simulated = current;

  for (const nodeId of removedIds) {
    changes.push({
      kind: "remove_node",
      baseRevisionId: headRevisionId,
      nodeId,
    });
    simulated = removeLiteraryNode(simulated, nodeId);
  }

  for (const nodeId of traversal(desired)) {
    if (nodeId === desired.rootId) continue;
    const desiredNode = desired.nodes[nodeId]!;
    const currentNode = simulated.nodes[nodeId];
    if (currentNode === undefined || currentNode.removed || desiredNode.parentId === undefined) {
      continue;
    }
    const desiredParent = desired.nodes[desiredNode.parentId];
    const currentParent = currentNode.parentId
      ? simulated.nodes[currentNode.parentId]
      : undefined;
    if (desiredParent === undefined || desiredParent.removed) {
      return unsupported(headRevisionId, `desired parent is unavailable for: ${nodeId}`);
    }
    const desiredIndex = desiredParent.childIds.indexOf(nodeId);
    const currentIndex = currentParent?.childIds.indexOf(nodeId) ?? -1;
    if (
      currentNode.parentId !== desiredNode.parentId ||
      currentIndex !== desiredIndex
    ) {
      changes.push({
        kind: "move_node",
        baseRevisionId: headRevisionId,
        nodeId,
        parentId: desiredNode.parentId,
        index: desiredIndex,
      });
      simulated = moveLiteraryNode(simulated, {
        nodeId,
        parentId: desiredNode.parentId,
        index: desiredIndex,
      });
    }
  }

  for (const nodeId of traversal(desired)) {
    const replacement = contentChanges.get(nodeId);
    if (replacement === undefined) continue;
    const node = simulated.nodes[nodeId];
    if (node?.contentRef === undefined) {
      return unsupported(headRevisionId, `canonical CC1 content reference is unavailable for: ${nodeId}`);
    }
    changes.push({
      kind: "replace_content",
      baseRevisionId: headRevisionId,
      nodeId,
      expectedContentVersion: node.contentRef,
      content: replacement.content,
    });
  }

  const linkUpdates = new Map<string, CanonicalProjectionLink>();

  if (changes.length === 0) {
    for (const [nodeId, fingerprint] of desiredFingerprints) {
      const node = current.nodes[nodeId];
      if (node?.contentRef === undefined) continue;
      const nextLink: CanonicalProjectionLink = {
        literaryNodeId: nodeId,
        autoEssay: fingerprint,
        coreContentVersion: node.contentRef,
        coreRevisionId: headRevisionId,
      };
      const existing = linksByNodeId.get(nodeId);
      if (existing === undefined || !sameProjectionLink(existing, nextLink)) {
        linkUpdates.set(nodeId, nextLink);
      }
    }
    if (linkUpdates.size === 0) {
      return { status: "noop", coreRevisionId: headRevisionId };
    }
    for (const link of linkUpdates.values()) {
      await input.store.saveProjectionLink(link);
    }
    return {
      status: "synchronized",
      coreRevisionId: headRevisionId,
      revisionCreated: false,
      changeKinds: [],
    };
  }

  const createdAt = new Date().toISOString();
  const revisionId = `canonical-sync:${crypto.randomUUID()}`;
  const changeSet = createChangeSet({
    id: `canonical-sync-changes:${crypto.randomUUID()}`,
    changes,
  });
  const commit = commitChangeSet({
    graph,
    manuscript: current,
    branchId: projectLink.canonicalBranchId,
    revisionId,
    expectedHeadRevisionId: headRevisionId,
    changeSet,
    author: { id: "autoessay-canonical-sync" },
    createdAt,
    message: "Synchronize AutoEssay canonical state",
    provenanceRefs: [
      { kind: "autoessay.canonical-sync", id: input.autoEssayProjectId },
    ],
  });

  await persistCommit(input.store, {
    projectId: projectLink.coreProjectId,
    expectedHeadRevisionId: headRevisionId,
    commit,
  });

  for (const [nodeId, fingerprint] of desiredFingerprints) {
    const node = commit.manuscript.nodes[nodeId];
    if (node === undefined || node.removed || node.contentRef === undefined) continue;
    const nextLink: CanonicalProjectionLink = {
      literaryNodeId: nodeId,
      autoEssay: fingerprint,
      coreContentVersion: node.contentRef,
      coreRevisionId: revisionId,
    };
    await input.store.saveProjectionLink(nextLink);
  }

  return {
    status: "synchronized",
    coreRevisionId: revisionId,
    revisionCreated: true,
    changeKinds: changes.map((change) => change.kind as CanonicalSyncChangeKind),
  };
}

export async function synchronizeAutoEssayCanonical(
  autoEssayProjectId: string
): Promise<CanonicalSyncResult> {
  return withProjectWriteLock(autoEssayProjectId, async () => {
    const [workspace, draftUnits] = await Promise.all([
      getWorkspace(autoEssayProjectId),
      listUnits(autoEssayProjectId),
    ]);
    return synchronizeAutoEssayCanonicalWhileLocked({
      autoEssayProjectId,
      manuscript: workspace.manuscript,
      draftUnits,
      store: createFileCollaborativeCoreStore(autoEssayProjectId),
    });
  });
}
