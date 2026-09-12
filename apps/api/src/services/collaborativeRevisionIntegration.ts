import { createHash } from "node:crypto";
import {
  DraftUnitSchema,
  advanceManuscriptUnitVersion,
  type DraftUnit,
  type Manuscript,
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
  type AutoEssayCollaborativeCoreStore,
  type IntegrationMaterializationReceipt,
} from "./collaborativeCoreStore.js";
import { synchronizeAutoEssayCanonicalWhileLocked } from "./collaborativeCoreCanonicalSync.js";
import {
  CollaborativeRevisionWorkDtoSchema,
  listCollaborativeRevisionWorks,
  loadCollaborativeRevisionWork,
  saveCollaborativeRevisionWork,
  type CollaborativeRevisionWorkDto,
} from "./collaborativeRevisionWorkStore.js";

export type IntegrationMaterializationFaultPoint =
  | "after_prepared_receipt"
  | "after_core_integration"
  | "after_core_integrated_receipt"
  | "after_draft_unit_write"
  | "after_manuscript_write"
  | "after_projection_link"
  | "after_work_update"
  | "after_applied_receipt";

export type IntegrationMaterializationFaultInjection = (
  point: IntegrationMaterializationFaultPoint
) => void | Promise<void>;

export type IntegrationMaterializationRecoveryCode =
  | "canonical_diverged"
  | "prepared_without_integration"
  | "integration_missing"
  | "recovery_context_missing";

export class IntegrationMaterializationRecoveryError extends Error {
  readonly name = "IntegrationMaterializationRecoveryError";

  constructor(
    readonly code: IntegrationMaterializationRecoveryCode,
    message: string,
    readonly receiptId?: string
  ) {
    super(message);
  }
}

export type IntegrateCollaborativeParagraphRevisionInput = {
  projectId: string;
  unitId: string;
  workId: string;
  editorialConflicts?: EditorialConflictDeclaration[];
  faultInjection?: IntegrationMaterializationFaultInjection;
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

type RecoverWhileLockedOptions = {
  allowPreparedIntegrationId?: string;
  faultInjection?: IntegrationMaterializationFaultInjection;
};

function contentHash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

async function injectFault(
  faultInjection: IntegrationMaterializationFaultInjection | undefined,
  point: IntegrationMaterializationFaultPoint
): Promise<void> {
  await faultInjection?.(point);
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

function requireCurrentUnit(units: DraftUnit[], unitId: string): DraftUnit {
  const unit = units.find((candidate) => candidate.id === unitId);
  if (unit === undefined) throw new Error(`DraftUnit not found: ${unitId}`);
  if (unit.granularity !== "paragraph") {
    throw new Error("collaborative Integration only supports paragraph DraftUnits");
  }
  return unit;
}

function fingerprintMatches(
  unit: DraftUnit,
  fingerprint: { unitId: string; unitVersion: number; contentHash: string }
): boolean {
  return (
    unit.id === fingerprint.unitId &&
    unit.version === fingerprint.unitVersion &&
    contentHash(unit.content) === fingerprint.contentHash
  );
}

function targetMatches(unit: DraftUnit, receipt: IntegrationMaterializationReceipt): boolean {
  return (
    unit.id === receipt.unitId &&
    unit.version === receipt.targetVersion &&
    contentHash(unit.content) === receipt.targetContentHash
  );
}

function collectManuscriptUnitVersions(manuscript: Manuscript, unitId: string): number[] {
  const versions: number[] = [];

  const visit = (entries: Manuscript["tree"]): void => {
    for (const entry of entries) {
      if (entry.kind === "leaf") {
        if (entry.unitId === unitId) versions.push(entry.version);
        continue;
      }
      for (const planEntry of entry.plan ?? []) {
        if (planEntry.unitId === unitId && planEntry.unitVersion !== undefined) {
          versions.push(planEntry.unitVersion);
        }
      }
      visit(entry.children);
    }
  };

  visit(manuscript.tree);
  return versions;
}

function manuscriptAtVersion(manuscript: Manuscript, unitId: string, version: number): boolean {
  const versions = collectManuscriptUnitVersions(manuscript, unitId);
  return versions.length > 0 && versions.every((current) => current === version);
}

function recoveryError(
  code: IntegrationMaterializationRecoveryCode,
  receipt: IntegrationMaterializationReceipt,
  detail: string
): IntegrationMaterializationRecoveryError {
  return new IntegrationMaterializationRecoveryError(
    code,
    `materialization recovery failed for '${receipt.id}': ${detail}`,
    receipt.id
  );
}

async function findWorkForReceipt(
  projectId: string,
  receipt: IntegrationMaterializationReceipt
): Promise<CollaborativeRevisionWorkDto> {
  const works = await listCollaborativeRevisionWorks(projectId);
  const matches = works.filter(
    (work) => work.proposalId === receipt.proposalId || work.integrationId === receipt.integrationId
  );
  if (matches.length !== 1) {
    throw recoveryError(
      "recovery_context_missing",
      receipt,
      `expected one collaborative work, found ${matches.length}`
    );
  }
  return matches[0]!;
}

async function resolveRecoveryTarget(input: {
  store: AutoEssayCollaborativeCoreStore;
  coreProjectId: string;
  receipt: IntegrationMaterializationReceipt;
  work: CollaborativeRevisionWorkDto;
}): Promise<{
  integration: Integration;
  proposal: Proposal;
  contentRef: { nodeId: string; version: number };
  content: string;
}> {
  const integration = await input.store.loadIntegration(
    input.coreProjectId,
    input.receipt.integrationId
  );
  if (integration === undefined) {
    throw recoveryError(
      "integration_missing",
      input.receipt,
      "receipt says the Core Integration is durable but it is missing"
    );
  }
  if (integration.revisionId !== input.receipt.coreRevisionId) {
    throw recoveryError(
      "recovery_context_missing",
      input.receipt,
      "Integration revision does not match receipt"
    );
  }
  const proposal = await input.store.loadProposal(input.coreProjectId, input.receipt.proposalId);
  if (proposal === undefined || proposal.integrationId !== integration.id) {
    throw recoveryError(
      "recovery_context_missing",
      input.receipt,
      "integrated Proposal is missing or inconsistent"
    );
  }
  const manuscript = await input.store.loadManuscriptAtRevision(
    input.coreProjectId,
    input.receipt.coreRevisionId
  );
  const node = manuscript?.nodes[input.work.literaryNodeId];
  if (
    node === undefined ||
    node.removed ||
    node.kind !== "paragraph" ||
    node.contentRef === undefined
  ) {
    throw recoveryError(
      "recovery_context_missing",
      input.receipt,
      "integrated literary paragraph is unavailable"
    );
  }
  const contentVersion = await input.store.resolveContentVersion(
    input.coreProjectId,
    input.receipt.coreRevisionId,
    node.contentRef.nodeId,
    node.contentRef.version
  );
  if (
    contentVersion === undefined ||
    contentHash(contentVersion.content) !== input.receipt.targetContentHash
  ) {
    throw recoveryError(
      "recovery_context_missing",
      input.receipt,
      "integrated target content does not match receipt"
    );
  }
  return {
    integration,
    proposal,
    contentRef: node.contentRef,
    content: contentVersion.content,
  };
}

async function materializeIntegratedReceiptWhileLocked(input: {
  projectId: string;
  store: AutoEssayCollaborativeCoreStore;
  receipt: IntegrationMaterializationReceipt;
  faultInjection?: IntegrationMaterializationFaultInjection;
}): Promise<IntegrationMaterializationReceipt> {
  const projectLink = await input.store.loadProjectLink();
  if (projectLink === undefined) {
    throw recoveryError(
      "recovery_context_missing",
      input.receipt,
      "collaborative project link is missing"
    );
  }
  const work = await findWorkForReceipt(input.projectId, input.receipt);
  const target = await resolveRecoveryTarget({
    store: input.store,
    coreProjectId: projectLink.coreProjectId,
    receipt: input.receipt,
    work,
  });

  let workspace = await getWorkspace(input.projectId);
  let units = await listUnits(input.projectId);
  let currentUnit = requireCurrentUnit(units, input.receipt.unitId);

  const unitIsSource = fingerprintMatches(currentUnit, input.receipt.expectedSource);
  const unitIsTarget = targetMatches(currentUnit, input.receipt);
  if (!unitIsSource && !unitIsTarget) {
    throw recoveryError(
      "canonical_diverged",
      input.receipt,
      "DraftUnit is neither the expected source nor the expected target"
    );
  }

  const manuscriptIsSource = manuscriptAtVersion(
    workspace.manuscript,
    input.receipt.unitId,
    input.receipt.expectedSource.unitVersion
  );
  const manuscriptIsTarget = manuscriptAtVersion(
    workspace.manuscript,
    input.receipt.unitId,
    input.receipt.targetVersion
  );
  if (!manuscriptIsSource && !manuscriptIsTarget) {
    throw recoveryError(
      "canonical_diverged",
      input.receipt,
      "manuscript references are neither the expected source nor the expected target"
    );
  }

  if (unitIsSource) {
    const nextUnit = DraftUnitSchema.parse({
      ...currentUnit,
      content: target.content,
      version: input.receipt.targetVersion,
      updatedAt: new Date().toISOString(),
    });
    units = units.map((unit) => (unit.id === nextUnit.id ? nextUnit : unit));
    await replaceUnitsWhileLocked(input.projectId, units);
    currentUnit = nextUnit;
    await injectFault(input.faultInjection, "after_draft_unit_write");
  }

  if (manuscriptIsSource) {
    const nextManuscript = advanceManuscriptUnitVersion(
      workspace.manuscript,
      input.receipt.unitId,
      input.receipt.expectedSource.unitVersion,
      input.receipt.targetVersion
    );
    workspace = {
      ...workspace,
      manuscript: {
        ...nextManuscript,
        updatedAt: new Date().toISOString(),
      },
    };
    await putWorkspaceWhileLocked(input.projectId, workspace);
    await injectFault(input.faultInjection, "after_manuscript_write");
  }

  const projectionLink = CanonicalProjectionLinkSchema.parse({
    literaryNodeId: work.literaryNodeId,
    autoEssay: {
      unitId: currentUnit.id,
      unitVersion: currentUnit.version,
      contentHash: contentHash(currentUnit.content),
    },
    coreContentVersion: target.contentRef,
    coreRevisionId: target.integration.revisionId,
  });
  await input.store.saveProjectionLink(projectionLink);
  await injectFault(input.faultInjection, "after_projection_link");

  if (work.status !== "integrated" || work.integrationId !== target.integration.id) {
    const integratedWork = CollaborativeRevisionWorkDtoSchema.parse({
      ...work,
      status: "integrated",
      integrationId: target.integration.id,
    });
    await saveCollaborativeRevisionWork(integratedWork);
  }
  await injectFault(input.faultInjection, "after_work_update");

  const applied = IntegrationMaterializationReceiptSchema.parse({
    ...input.receipt,
    status: "applied",
    appliedAt: input.receipt.appliedAt ?? new Date().toISOString(),
  });
  await input.store.saveMaterializationReceipt(applied);
  await injectFault(input.faultInjection, "after_applied_receipt");
  return applied;
}

export async function recoverIncompleteIntegrationMaterializationsWhileLocked(
  projectId: string,
  options: RecoverWhileLockedOptions = {}
): Promise<IntegrationMaterializationReceipt[]> {
  const store = createFileCollaborativeCoreStore(projectId);
  const projectLink = await store.loadProjectLink();
  if (projectLink === undefined) return [];

  const receipts = (await store.listMaterializationReceipts()).filter(
    (receipt) => receipt.status !== "applied"
  );
  const recovered: IntegrationMaterializationReceipt[] = [];

  for (const initialReceipt of receipts) {
    let receipt = initialReceipt;
    const integration = await store.loadIntegration(
      projectLink.coreProjectId,
      receipt.integrationId
    );

    if (integration === undefined) {
      if (
        receipt.status === "prepared" &&
        options.allowPreparedIntegrationId === receipt.integrationId
      ) {
        continue;
      }
      if (receipt.status === "prepared") {
        throw recoveryError(
          "prepared_without_integration",
          receipt,
          "prepared attempt has no durable Integration; retry that Integration explicitly"
        );
      }
      throw recoveryError(
        "integration_missing",
        receipt,
        "core_integrated receipt has no durable Integration"
      );
    }

    if (receipt.status === "prepared") {
      receipt = IntegrationMaterializationReceiptSchema.parse({
        ...receipt,
        status: "core_integrated",
      });
      await store.saveMaterializationReceipt(receipt);
    }

    recovered.push(
      await materializeIntegratedReceiptWhileLocked({
        projectId,
        store,
        receipt,
        faultInjection: options.faultInjection,
      })
    );
  }

  return recovered;
}

export async function recoverIncompleteIntegrationMaterializations(
  projectId: string
): Promise<IntegrationMaterializationReceipt[]> {
  return withProjectWriteLock(projectId, () =>
    recoverIncompleteIntegrationMaterializationsWhileLocked(projectId)
  );
}

async function loadIntegratedResult(input: {
  projectId: string;
  unitId: string;
  work: CollaborativeRevisionWorkDto;
  store: AutoEssayCollaborativeCoreStore;
}): Promise<IntegrateCollaborativeParagraphRevisionResult> {
  if (input.work.proposalId === undefined || input.work.integrationId === undefined) {
    throw new Error("integrated collaborative revision work lacks Proposal or Integration identity");
  }
  const projectLink = await input.store.loadProjectLink();
  if (projectLink === undefined) throw new Error("collaborative project link is missing");
  const proposal = await input.store.loadProposal(projectLink.coreProjectId, input.work.proposalId);
  const integration = await input.store.loadIntegration(
    projectLink.coreProjectId,
    input.work.integrationId
  );
  const receipt = await input.store.loadMaterializationReceipt(
    `materialization:${input.work.integrationId}`
  );
  const unit = requireCurrentUnit(await listUnits(input.projectId), input.unitId);
  if (
    proposal === undefined ||
    integration === undefined ||
    receipt === undefined ||
    receipt.status !== "applied" ||
    !targetMatches(unit, receipt)
  ) {
    throw new Error("integrated collaborative revision recovery state is incomplete");
  }
  return {
    status: "integrated",
    work: input.work,
    proposal,
    integration,
    receipt,
    unit,
  };
}

export async function integrateCollaborativeParagraphRevision(
  input: IntegrateCollaborativeParagraphRevisionInput
): Promise<IntegrateCollaborativeParagraphRevisionResult> {
  return withProjectWriteLock(input.projectId, async () => {
    let work = requireWorkScope(
      await loadCollaborativeRevisionWork(input.projectId, input.workId),
      input
    );
    const expectedIntegrationId =
      work.proposalId === undefined ? undefined : `integration:${work.proposalId}`;

    await recoverIncompleteIntegrationMaterializationsWhileLocked(input.projectId, {
      allowPreparedIntegrationId: expectedIntegrationId,
    });

    work = requireWorkScope(
      await loadCollaborativeRevisionWork(input.projectId, input.workId),
      input
    );
    const store = createFileCollaborativeCoreStore(input.projectId);

    if (work.status === "integrated") {
      return loadIntegratedResult({
        projectId: input.projectId,
        unitId: input.unitId,
        work,
        store,
      });
    }
    if (work.status === "rejected") {
      throw new Error("rejected collaborative revision work cannot be integrated");
    }
    const proposalId = work.proposalId;
    if (proposalId === undefined) {
      throw new Error("collaborative revision work has no reviewed Proposal");
    }

    const workspace = await getWorkspace(input.projectId);
    const units = await listUnits(input.projectId);
    const currentUnit = requireCurrentUnit(units, work.unitId);

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
    const receiptId = `materialization:${integrationId}`;
    const existingReceipt = await store.loadMaterializationReceipt(receiptId);
    let receipt = IntegrationMaterializationReceiptSchema.parse(
      existingReceipt ?? {
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
        targetContentHash: contentHash(integratedContentVersion.content),
        status: "prepared",
        createdAt: now,
      }
    );

    if (
      receipt.proposalId !== proposal.id ||
      receipt.integrationId !== integrationId ||
      receipt.coreRevisionId !== revisionId ||
      !fingerprintMatches(currentUnit, receipt.expectedSource) ||
      receipt.targetVersion !== targetVersion ||
      receipt.targetContentHash !== contentHash(integratedContentVersion.content)
    ) {
      throw recoveryError(
        "canonical_diverged",
        receipt,
        "retry attempt no longer matches the prepared source/target identity"
      );
    }

    await store.saveMaterializationReceipt(receipt);
    await injectFault(input.faultInjection, "after_prepared_receipt");

    await persistCommit(store, {
      projectId: projectLink.coreProjectId,
      expectedHeadRevisionId: canonicalBranch.headRevisionId,
      commit: integrated.commit,
    });
    await store.saveProposal(integrated.proposal);
    await store.saveIntegration(projectLink.coreProjectId, integrated.integration);
    await injectFault(input.faultInjection, "after_core_integration");

    receipt = IntegrationMaterializationReceiptSchema.parse({
      ...receipt,
      status: "core_integrated",
    });
    await store.saveMaterializationReceipt(receipt);
    await injectFault(input.faultInjection, "after_core_integrated_receipt");

    receipt = await materializeIntegratedReceiptWhileLocked({
      projectId: input.projectId,
      store,
      receipt,
      faultInjection: input.faultInjection,
    });

    work = requireWorkScope(
      await loadCollaborativeRevisionWork(input.projectId, input.workId),
      input
    );
    const finalProposal = await store.loadProposal(projectLink.coreProjectId, proposal.id);
    const finalIntegration = await store.loadIntegration(projectLink.coreProjectId, integrationId);
    const finalUnit = requireCurrentUnit(await listUnits(input.projectId), input.unitId);
    if (finalProposal === undefined || finalIntegration === undefined) {
      throw new Error("Integration persistence is incomplete after materialization");
    }

    return {
      status: "integrated",
      work,
      proposal: finalProposal,
      integration: finalIntegration,
      receipt,
      unit: finalUnit,
    };
  });
}
