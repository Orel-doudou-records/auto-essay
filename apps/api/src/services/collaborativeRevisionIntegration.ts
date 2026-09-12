import { createHash } from "node:crypto";
import {
  DraftUnitSchema,
  advanceManuscriptUnitVersion,
  type DraftUnit,
} from "@auto-essay/core";
import {
  ProposalConflictError,
  integrateProposal,
  persistCommit,
  type ConflictAssessment,
  type EditorialConflictDeclaration,
  type Integration,
  type Proposal,
} from "writing-engine";
import { getWorkspace, putWorkspaceWhileLocked } from "./editorialWorkspaceStore.js";
import { withProjectWriteLock } from "./projectWriteLock.js";
import { listUnits, replaceUnitsWhileLocked } from "./unitStore.js";
import {
  CanonicalProjectionLinkSchema,
  IntegrationMaterializationReceiptSchema,
  createFileCollaborativeCoreStore,
  type IntegrationMaterializationReceipt,
} from "./collaborativeCoreStore.js";
import { synchronizeAutoEssayCanonicalWhileLocked } from "./collaborativeCoreCanonicalSync.js";
import {
  CollaborativeRevisionWorkDtoSchema,
  loadCollaborativeRevisionWork,
  saveCollaborativeRevisionWork,
  type CollaborativeRevisionWorkDto,
} from "./collaborativeRevisionWorkStore.js";

export type IntegrateCollaborativeParagraphRevisionInput = {
  projectId: string;
  unitId: string;
  workId: string;
  editorialConflicts?: EditorialConflictDeclaration[];
};

export type IntegrateCollaborativeParagraphRevisionResult =
  | {
      status: "integrated";
      work: CollaborativeRevisionWorkDto;
      proposal: Proposal;
      integration: Integration;
      receipt: IntegrationMaterializationReceipt;
      unit: DraftUnit;
    }
  | {
      status: "blocked";
      work: CollaborativeRevisionWorkDto;
      proposal: Proposal;
      assessment: ConflictAssessment;
    }
  | {
      status: "unsupported_projection_drift";
      work: CollaborativeRevisionWorkDto;
      reason: string;
    };

function contentHash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function requireWorkScope(
  work: CollaborativeRevisionWorkDto | undefined,
  input: IntegrateCollaborativeParagraphRevisionInput
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
  if (work.status === "rejected") {
    throw new Error("rejected collaborative revision work cannot be integrated");
  }
  if (work.status === "integrated") {
    throw new Error("collaborative revision work is already integrated");
  }
  if (work.proposalId === undefined) {
    throw new Error("collaborative revision work has no reviewed Proposal");
  }
  return work;
}

function requireCurrentUnit(units: DraftUnit[], work: CollaborativeRevisionWorkDto): DraftUnit {
  const unit = units.find((candidate) => candidate.id === work.unitId);
  if (unit === undefined) throw new Error(`DraftUnit not found: ${work.unitId}`);
  if (unit.granularity !== "paragraph") {
    throw new Error("collaborative Integration only supports paragraph DraftUnits");
  }
  return unit;
}

async function rollbackAutoEssayUnits(
  projectId: string,
  previousUnits: DraftUnit[],
  originalError: unknown
): Promise<never> {
  try {
    await replaceUnitsWhileLocked(projectId, previousUnits);
  } catch (rollbackError) {
    throw new AggregateError(
      [originalError, rollbackError],
      "AutoEssay manuscript materialization failed and DraftUnit rollback also failed"
    );
  }
  throw originalError;
}

export async function integrateCollaborativeParagraphRevision(
  input: IntegrateCollaborativeParagraphRevisionInput
): Promise<IntegrateCollaborativeParagraphRevisionResult> {
  return withProjectWriteLock(input.projectId, async () => {
    let work = requireWorkScope(
      await loadCollaborativeRevisionWork(input.projectId, input.workId),
      input
    );
    const proposalId = work.proposalId;
    if (proposalId === undefined) {
      throw new Error("collaborative revision work has no reviewed Proposal");
    }
    const workspace = await getWorkspace(input.projectId);
    const units = await listUnits(input.projectId);
    const currentUnit = requireCurrentUnit(units, work);
    const store = createFileCollaborativeCoreStore(input.projectId);

    const synchronized = await synchronizeAutoEssayCanonicalWhileLocked({
      autoEssayProjectId: input.projectId,
      manuscript: workspace.manuscript,
      draftUnits: units,
      store,
    });
    if (synchronized.status === "unsupported_projection_drift") {
      return {
        status: "unsupported_projection_drift",
        work,
        reason: synchronized.reason,
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
    const canonicalManuscript = await store.loadCurrentManuscript(
      projectLink.coreProjectId,
      projectLink.canonicalBranchId
    );
    if (canonicalManuscript === undefined) {
      throw new Error("canonical CC1 manuscript snapshot is missing");
    }
    const proposal = await store.loadProposal(projectLink.coreProjectId, proposalId);
    if (proposal === undefined) {
      throw new Error(`reviewed Proposal not found: ${proposalId}`);
    }
    if (proposal.status !== "approved") {
      throw new Error(`Proposal '${proposal.id}' is not approved`);
    }

    const integrationId = `integration:${proposal.id}`;
    const revisionId = `${integrationId}:revision`;
    const now = new Date().toISOString();

    let integrated;
    try {
      integrated = integrateProposal({
        proposal,
        graph,
        manuscript: canonicalManuscript,
        targetBranchId: projectLink.canonicalBranchId,
        expectedHeadRevisionId: canonicalBranch.headRevisionId,
        revisionId,
        integrationId,
        integrator: { id: "autoessay:author" },
        createdAt: now,
        additionalParentIds: [work.headRevisionId],
        message: "Integrate accepted AutoEssay revise-chat work",
        provenanceRefs: [
          { kind: "autoessay.revise-chat", id: work.id },
          { kind: "autoessay.draft-unit", id: work.unitId },
        ],
        editorialConflicts: input.editorialConflicts,
      });
    } catch (error) {
      if (!(error instanceof ProposalConflictError)) throw error;
      let blockedProposal = proposal;
      if (error.staleProposal !== undefined) {
        blockedProposal = error.staleProposal;
        await store.saveProposal(blockedProposal);
        work = CollaborativeRevisionWorkDtoSchema.parse({ ...work, status: "stale" });
        await saveCollaborativeRevisionWork(work);
      }
      return {
        status: "blocked",
        work,
        proposal: blockedProposal,
        assessment: error.assessment,
      };
    }

    const integratedNode = integrated.commit.manuscript.nodes[work.literaryNodeId];
    if (
      integratedNode === undefined ||
      integratedNode.removed ||
      integratedNode.kind !== "paragraph" ||
      integratedNode.contentRef === undefined
    ) {
      throw new Error("integrated literary paragraph is unavailable");
    }
    const integratedContentVersion = integrated.commit.contentVersions.find(
      (version) =>
        version.nodeId === integratedNode.contentRef!.nodeId &&
        version.version === integratedNode.contentRef!.version
    );
    if (integratedContentVersion === undefined) {
      throw new Error("Integration did not produce the final paragraph ContentVersion");
    }

    const targetVersion = currentUnit.version + 1;
    const nextManuscript = advanceManuscriptUnitVersion(
      workspace.manuscript,
      currentUnit.id,
      currentUnit.version,
      targetVersion
    );
    const materializedAt = new Date().toISOString();
    const nextUnit = DraftUnitSchema.parse({
      ...currentUnit,
      content: integratedContentVersion.content,
      version: targetVersion,
      updatedAt: materializedAt,
    });
    const nextUnits = units.map((unit) => (unit.id === currentUnit.id ? nextUnit : unit));

    const receiptId = `materialization:${integrationId}`;
    let receipt = IntegrationMaterializationReceiptSchema.parse({
      id: receiptId,
      projectId: input.projectId,
      proposalId: proposal.id,
      integrationId: integrated.integration.id,
      coreRevisionId: integrated.integration.revisionId,
      unitId: currentUnit.id,
      expectedSource: {
        unitId: currentUnit.id,
        unitVersion: currentUnit.version,
        contentHash: contentHash(currentUnit.content),
      },
      targetVersion,
      targetContentHash: contentHash(nextUnit.content),
      status: "prepared",
      createdAt: now,
    });
    await store.saveMaterializationReceipt(receipt);

    await persistCommit(store, {
      projectId: projectLink.coreProjectId,
      expectedHeadRevisionId: canonicalBranch.headRevisionId,
      commit: integrated.commit,
    });
    await store.saveProposal(integrated.proposal);
    await store.saveIntegration(projectLink.coreProjectId, integrated.integration);

    receipt = IntegrationMaterializationReceiptSchema.parse({
      ...receipt,
      status: "core_integrated",
    });
    await store.saveMaterializationReceipt(receipt);

    await replaceUnitsWhileLocked(input.projectId, nextUnits);
    try {
      await putWorkspaceWhileLocked(input.projectId, {
        manuscript: {
          ...nextManuscript,
          updatedAt: materializedAt,
        },
        distribution: workspace.distribution,
        profiles: workspace.profiles,
        articulations: workspace.articulations,
      });
    } catch (error) {
      await rollbackAutoEssayUnits(input.projectId, units, error);
    }

    const projectionLink = CanonicalProjectionLinkSchema.parse({
      literaryNodeId: work.literaryNodeId,
      autoEssay: {
        unitId: nextUnit.id,
        unitVersion: nextUnit.version,
        contentHash: contentHash(nextUnit.content),
      },
      coreContentVersion: integratedNode.contentRef,
      coreRevisionId: integrated.integration.revisionId,
    });
    await store.saveProjectionLink(projectionLink);

    work = CollaborativeRevisionWorkDtoSchema.parse({
      ...work,
      status: "integrated",
      integrationId: integrated.integration.id,
    });
    await saveCollaborativeRevisionWork(work);

    receipt = IntegrationMaterializationReceiptSchema.parse({
      ...receipt,
      status: "applied",
      appliedAt: new Date().toISOString(),
    });
    await store.saveMaterializationReceipt(receipt);

    return {
      status: "integrated",
      work,
      proposal: integrated.proposal,
      integration: integrated.integration,
      receipt,
      unit: nextUnit,
    };
  });
}
