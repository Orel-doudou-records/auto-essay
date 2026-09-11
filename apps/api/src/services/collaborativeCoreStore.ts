import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  projectAutoEssayManuscriptToCollaborativeCore,
  type DraftUnit,
  type Manuscript,
} from "@auto-essay/core";
import {
  ChangeSetSchema,
  ContentVersionRefSchema,
  ContentVersionSchema,
  IntegrationSchema,
  ManuscriptSnapshotSchema,
  ProposalSchema,
  ReviewDecisionSchema,
  RevisionGraphSchema,
  RevisionSchema,
  TaskSchema,
  WorkBranchSchema,
  createRevisionGraph,
  type CollaborativeCoreStore,
  type ContentVersion,
  type Integration,
  type LiteraryManuscript,
  type ManuscriptSnapshot,
  type Proposal,
  type ReviewDecision,
  type RevisionGraph,
  type Task,
} from "writing-engine";
import { getDataDir } from "../config.js";

const IdSchema = z.string().trim().min(1);
const ContentHashSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const AutoEssayCollaborativeProjectLinkSchema = z.object({
  autoEssayProjectId: IdSchema,
  coreProjectId: IdSchema,
  canonicalBranchId: IdSchema,
});
export type AutoEssayCollaborativeProjectLink = z.infer<
  typeof AutoEssayCollaborativeProjectLinkSchema
>;

export const AutoEssayCanonicalFingerprintSchema = z.object({
  unitId: IdSchema,
  unitVersion: z.number().int().positive(),
  contentHash: ContentHashSchema,
});
export type AutoEssayCanonicalFingerprint = z.infer<
  typeof AutoEssayCanonicalFingerprintSchema
>;

export const CanonicalProjectionLinkSchema = z.object({
  literaryNodeId: IdSchema,
  autoEssay: AutoEssayCanonicalFingerprintSchema,
  coreContentVersion: ContentVersionRefSchema,
  coreRevisionId: IdSchema,
});
export type CanonicalProjectionLink = z.infer<typeof CanonicalProjectionLinkSchema>;

export const IntegrationMaterializationReceiptSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  proposalId: IdSchema,
  integrationId: IdSchema,
  coreRevisionId: IdSchema,
  unitId: IdSchema,
  expectedSource: AutoEssayCanonicalFingerprintSchema,
  targetVersion: z.number().int().positive(),
  targetContentHash: ContentHashSchema,
  status: z.enum(["prepared", "core_integrated", "applied"]),
  createdAt: z.string().datetime(),
  appliedAt: z.string().datetime().optional(),
});
export type IntegrationMaterializationReceipt = z.infer<
  typeof IntegrationMaterializationReceiptSchema
>;

type StoredContentVersion = {
  revisionId: string;
  value: ContentVersion;
};

const StoredContentVersionSchema = z.object({
  revisionId: IdSchema,
  value: ContentVersionSchema,
});

const FileCollaborativeCoreStateSchema = z.object({
  schemaVersion: z.literal(1),
  autoEssayProjectId: IdSchema,
  graph: RevisionGraphSchema,
  contentVersions: z.array(StoredContentVersionSchema),
  snapshots: z.record(ManuscriptSnapshotSchema),
  tasks: z.record(TaskSchema),
  proposals: z.record(ProposalSchema),
  reviewDecisions: z.array(ReviewDecisionSchema),
  integrations: z.record(IntegrationSchema),
  projectLink: AutoEssayCollaborativeProjectLinkSchema.optional(),
  projectionLinks: z.record(CanonicalProjectionLinkSchema),
  materializationReceipts: z.record(IntegrationMaterializationReceiptSchema),
});

type FileCollaborativeCoreState = z.infer<typeof FileCollaborativeCoreStateSchema>;

export interface AutoEssayCollaborativeCoreStore extends CollaborativeCoreStore {
  loadProjectLink(): Promise<AutoEssayCollaborativeProjectLink | undefined>;
  saveProjectLink(link: AutoEssayCollaborativeProjectLink): Promise<void>;
  listProjectionLinks(): Promise<CanonicalProjectionLink[]>;
  loadProjectionLink(literaryNodeId: string): Promise<CanonicalProjectionLink | undefined>;
  saveProjectionLink(link: CanonicalProjectionLink): Promise<void>;
  saveMaterializationReceipt(receipt: IntegrationMaterializationReceipt): Promise<void>;
  loadMaterializationReceipt(id: string): Promise<IntegrationMaterializationReceipt | undefined>;
  listMaterializationReceipts(): Promise<IntegrationMaterializationReceipt[]>;
}

export type CreateFileCollaborativeCoreStoreOptions = {
  dataDir?: string;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function equal(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function readJson(filePath: string): Promise<unknown | undefined> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(value, null, 2), "utf8");
  await fs.rename(tempPath, filePath);
}

function findFirstParentRevisionIds(graph: RevisionGraph, revisionId: string): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined = revisionId;
  while (cursor !== undefined) {
    if (seen.has(cursor)) throw new Error(`revision cycle detected: ${cursor}`);
    seen.add(cursor);
    const revision = graph.revisions[cursor];
    if (revision === undefined) throw new Error(`revision not found: ${cursor}`);
    ids.push(cursor);
    cursor = revision.parentIds[0];
  }
  return ids;
}

function walkAllAncestors(graph: RevisionGraph, revisionId: string): string[] {
  if (graph.revisions[revisionId] === undefined) throw new Error(`revision not found: ${revisionId}`);
  const result: string[] = [];
  const queue = [...graph.revisions[revisionId]!.parentIds];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const revision = graph.revisions[id];
    if (revision === undefined) throw new Error(`revision not found: ${id}`);
    result.push(id);
    queue.push(...revision.parentIds);
  }
  return result;
}

function appendImmutable<T extends { id: string }>(
  current: T[],
  value: T,
  conflictMessage: string
): T[] {
  const existing = current.find((entry) => entry.id === value.id);
  if (existing === undefined) return [...current, value];
  if (!equal(existing, value)) throw new Error(conflictMessage);
  return current;
}

export function createFileCollaborativeCoreStore(
  autoEssayProjectId: string,
  options: CreateFileCollaborativeCoreStoreOptions = {}
): AutoEssayCollaborativeCoreStore {
  const dataDir = options.dataDir ?? getDataDir();
  const filePath = path.join(
    dataDir,
    autoEssayProjectId,
    "collaborative-core",
    "state.json"
  );

  async function readState(): Promise<FileCollaborativeCoreState | undefined> {
    const raw = await readJson(filePath);
    if (raw === undefined) return undefined;
    const parsed = FileCollaborativeCoreStateSchema.parse(raw);
    if (parsed.autoEssayProjectId !== autoEssayProjectId) {
      throw new Error("collaborative core state belongs to another AutoEssay project");
    }
    return parsed;
  }

  async function requireState(projectId?: string): Promise<FileCollaborativeCoreState> {
    const state = await readState();
    if (state === undefined) throw new Error(`collaborative core project not found: ${autoEssayProjectId}`);
    if (projectId !== undefined && state.graph.projectId !== projectId) {
      throw new Error(`project not found: ${projectId}`);
    }
    return state;
  }

  async function writeState(state: FileCollaborativeCoreState): Promise<void> {
    await writeJsonAtomic(filePath, FileCollaborativeCoreStateSchema.parse(state));
  }

  return {
    async initializeProject(input) {
      const graph = RevisionGraphSchema.parse(input.graph);
      const manuscript = input.manuscript;
      const existing = await readState();
      if (existing !== undefined) {
        if (existing.graph.projectId !== graph.projectId) {
          throw new Error("collaborative core project already initialized with another id");
        }
        return;
      }
      const canonical = graph.branches[graph.canonicalBranchId];
      if (canonical === undefined || !canonical.canonical) {
        throw new Error("canonical branch not found during project initialization");
      }
      const canonicalRevision = graph.revisions[canonical.headRevisionId];
      if (canonicalRevision === undefined) {
        throw new Error("canonical revision not found during project initialization");
      }
      const initialVersions = (input.contentVersions ?? []).map((value) => ({
        revisionId: canonical.headRevisionId,
        value: ContentVersionSchema.parse(value),
      }));
      const snapshot = ManuscriptSnapshotSchema.parse({
        projectId: graph.projectId,
        revisionId: canonical.headRevisionId,
        manuscript,
        materializedAt: canonicalRevision.createdAt,
      });
      await writeState({
        schemaVersion: 1,
        autoEssayProjectId,
        graph,
        contentVersions: initialVersions,
        snapshots: { [snapshot.revisionId]: snapshot },
        tasks: {},
        proposals: {},
        reviewDecisions: [],
        integrations: {},
        projectionLinks: {},
        materializationReceipts: {},
      });
    },

    async loadRevisionGraph(projectId) {
      const state = await readState();
      if (state === undefined || state.graph.projectId !== projectId) return undefined;
      return clone(state.graph);
    },

    async loadRevision(projectId, revisionId) {
      const state = await readState();
      if (state === undefined || state.graph.projectId !== projectId) return undefined;
      const value = state.graph.revisions[revisionId];
      return value === undefined ? undefined : clone(value);
    },

    async loadChangeSet(projectId, changeSetId) {
      const state = await readState();
      if (state === undefined || state.graph.projectId !== projectId) return undefined;
      const value = state.graph.changeSets[changeSetId];
      return value === undefined ? undefined : clone(value);
    },

    async resolveContentVersion(projectId, revisionId, nodeId, version) {
      const state = await requireState(projectId);
      for (const currentRevisionId of findFirstParentRevisionIds(state.graph, revisionId)) {
        const match = state.contentVersions.find(
          (entry) =>
            entry.revisionId === currentRevisionId &&
            entry.value.nodeId === nodeId &&
            entry.value.version === version
        );
        if (match !== undefined) return clone(match.value);
      }
      return undefined;
    },

    async appendContentVersions(projectId, revisionId, versions) {
      const state = await requireState(projectId);
      if (state.graph.revisions[revisionId] === undefined) {
        throw new Error(`revision not found: ${revisionId}`);
      }
      let next = [...state.contentVersions];
      for (const inputValue of versions) {
        const value = ContentVersionSchema.parse(inputValue);
        const existing = next.find(
          (entry) =>
            entry.revisionId === revisionId &&
            entry.value.nodeId === value.nodeId &&
            entry.value.version === value.version
        );
        if (existing !== undefined) {
          if (!equal(existing.value, value)) {
            throw new Error(
              `immutable content version conflict: ${revisionId}:${value.nodeId}@${value.version}`
            );
          }
          continue;
        }
        next.push({ revisionId, value });
      }
      state.contentVersions = next;
      await writeState(state);
    },

    async appendChangeSet(projectId, inputValue) {
      const state = await requireState(projectId);
      const value = ChangeSetSchema.parse(inputValue);
      const existing = state.graph.changeSets[value.id];
      if (existing !== undefined && !equal(existing, value)) {
        throw new Error(`immutable ChangeSet conflict: ${value.id}`);
      }
      state.graph.changeSets[value.id] = value;
      await writeState(state);
    },

    async appendRevision(projectId, inputValue) {
      const state = await requireState(projectId);
      const value = RevisionSchema.parse(inputValue);
      if (value.projectId !== projectId) throw new Error("revision project does not match store project");
      if (state.graph.changeSets[value.changeSetId] === undefined) {
        throw new Error(`ChangeSet not found: ${value.changeSetId}`);
      }
      for (const parentId of value.parentIds) {
        if (state.graph.revisions[parentId] === undefined) throw new Error(`revision parent not found: ${parentId}`);
      }
      const existing = state.graph.revisions[value.id];
      if (existing !== undefined && !equal(existing, value)) {
        throw new Error(`immutable revision conflict: ${value.id}`);
      }
      state.graph.revisions[value.id] = value;
      state.graph = RevisionGraphSchema.parse(state.graph);
      await writeState(state);
    },

    async createBranch(projectId, inputValue) {
      const state = await requireState(projectId);
      const value = WorkBranchSchema.parse(inputValue);
      if (state.graph.revisions[value.headRevisionId] === undefined) {
        throw new Error(`revision not found: ${value.headRevisionId}`);
      }
      const existing = state.graph.branches[value.id];
      if (existing !== undefined) {
        if (!equal(existing, value)) throw new Error(`branch conflict: ${value.id}`);
        return;
      }
      if (value.canonical) throw new Error("additional branches cannot become canonical through createBranch");
      state.graph.branches[value.id] = value;
      state.graph = RevisionGraphSchema.parse(state.graph);
      await writeState(state);
    },

    async advanceBranchHead(input) {
      const state = await requireState(input.projectId);
      const branch = state.graph.branches[input.branchId];
      if (branch === undefined) throw new Error(`branch not found: ${input.branchId}`);
      if (branch.headRevisionId !== input.expectedHeadRevisionId) {
        throw new Error(
          `branch head mismatch: expected ${input.expectedHeadRevisionId}, got ${branch.headRevisionId}`
        );
      }
      const revision = state.graph.revisions[input.nextHeadRevisionId];
      if (revision === undefined) throw new Error(`revision not found: ${input.nextHeadRevisionId}`);
      if (revision.branchId !== branch.id) throw new Error("revision branch does not match branch head target");
      if (revision.parentIds[0] !== input.expectedHeadRevisionId) {
        throw new Error("next revision first parent must match expected branch head");
      }
      state.graph.branches[input.branchId] = { ...branch, headRevisionId: revision.id };
      state.graph = RevisionGraphSchema.parse(state.graph);
      await writeState(state);
    },

    async walkRevisionAncestors(projectId, revisionId) {
      const state = await requireState(projectId);
      return walkAllAncestors(state.graph, revisionId);
    },

    async materializeSnapshot(inputValue) {
      const state = await requireState(inputValue.projectId);
      const value = ManuscriptSnapshotSchema.parse(inputValue);
      if (state.graph.revisions[value.revisionId] === undefined) {
        throw new Error(`revision not found: ${value.revisionId}`);
      }
      const existing = state.snapshots[value.revisionId];
      if (existing !== undefined && !equal(existing, value)) {
        throw new Error(`snapshot conflict: ${value.revisionId}`);
      }
      state.snapshots[value.revisionId] = value;
      await writeState(state);
    },

    async loadSnapshot(projectId, revisionId) {
      const state = await readState();
      if (state === undefined || state.graph.projectId !== projectId) return undefined;
      const value = state.snapshots[revisionId];
      return value === undefined ? undefined : clone(value);
    },

    async loadCurrentManuscript(projectId, branchId) {
      const state = await requireState(projectId);
      const branch = state.graph.branches[branchId];
      if (branch === undefined) return undefined;
      const snapshot = state.snapshots[branch.headRevisionId];
      return snapshot === undefined ? undefined : clone(snapshot.manuscript);
    },

    async loadManuscriptAtRevision(projectId, revisionId) {
      const state = await requireState(projectId);
      const snapshot = state.snapshots[revisionId];
      return snapshot === undefined ? undefined : clone(snapshot.manuscript);
    },

    async saveTask(inputValue) {
      const value = TaskSchema.parse(inputValue);
      const state = await requireState(value.projectId);
      state.tasks[value.id] = value;
      await writeState(state);
    },

    async loadTask(projectId, taskId) {
      const state = await readState();
      if (state === undefined || state.graph.projectId !== projectId) return undefined;
      const value = state.tasks[taskId];
      return value === undefined ? undefined : clone(value);
    },

    async saveProposal(inputValue) {
      const value = ProposalSchema.parse(inputValue);
      const state = await requireState(value.projectId);
      state.proposals[value.id] = value;
      await writeState(state);
    },

    async loadProposal(projectId, proposalId) {
      const state = await readState();
      if (state === undefined || state.graph.projectId !== projectId) return undefined;
      const value = state.proposals[proposalId];
      return value === undefined ? undefined : clone(value);
    },

    async appendReviewDecisions(projectId, decisions) {
      const state = await requireState(projectId);
      let next = [...state.reviewDecisions];
      for (const inputValue of decisions) {
        const value = ReviewDecisionSchema.parse(inputValue);
        next = appendImmutable(next, value, `immutable review decision conflict: ${value.id}`);
      }
      state.reviewDecisions = next;
      await writeState(state);
    },

    async loadReviewDecisions(projectId, proposalId) {
      const state = await readState();
      if (state === undefined || state.graph.projectId !== projectId) return [];
      return clone(state.reviewDecisions.filter((decision) => decision.proposalId === proposalId));
    },

    async saveIntegration(projectId, inputValue) {
      const state = await requireState(projectId);
      const value = IntegrationSchema.parse(inputValue);
      const existing = state.integrations[value.id];
      if (existing !== undefined && !equal(existing, value)) {
        throw new Error(`immutable Integration conflict: ${value.id}`);
      }
      state.integrations[value.id] = value;
      await writeState(state);
    },

    async loadIntegration(projectId, integrationId) {
      const state = await readState();
      if (state === undefined || state.graph.projectId !== projectId) return undefined;
      const value = state.integrations[integrationId];
      return value === undefined ? undefined : clone(value);
    },

    async loadProjectLink() {
      return clone((await readState())?.projectLink);
    },

    async saveProjectLink(inputValue) {
      const state = await requireState();
      const value = AutoEssayCollaborativeProjectLinkSchema.parse(inputValue);
      if (value.autoEssayProjectId !== autoEssayProjectId || value.coreProjectId !== state.graph.projectId) {
        throw new Error("collaborative project link does not match store project");
      }
      if (value.canonicalBranchId !== state.graph.canonicalBranchId) {
        throw new Error("collaborative project link canonical branch mismatch");
      }
      if (state.projectLink !== undefined && !equal(state.projectLink, value)) {
        throw new Error("collaborative project link conflict");
      }
      state.projectLink = value;
      await writeState(state);
    },

    async listProjectionLinks() {
      const state = await readState();
      if (state === undefined) return [];
      return Object.values(state.projectionLinks)
        .map((value) => clone(value))
        .sort((left, right) => left.literaryNodeId.localeCompare(right.literaryNodeId));
    },

    async loadProjectionLink(literaryNodeId) {
      const state = await readState();
      const value = state?.projectionLinks[literaryNodeId];
      return value === undefined ? undefined : clone(value);
    },

    async saveProjectionLink(inputValue) {
      const state = await requireState();
      const value = CanonicalProjectionLinkSchema.parse(inputValue);
      if (state.graph.revisions[value.coreRevisionId] === undefined) {
        throw new Error(`revision not found: ${value.coreRevisionId}`);
      }
      state.projectionLinks[value.literaryNodeId] = value;
      await writeState(state);
    },

    async saveMaterializationReceipt(inputValue) {
      const state = await requireState();
      const value = IntegrationMaterializationReceiptSchema.parse(inputValue);
      if (value.projectId !== autoEssayProjectId) {
        throw new Error("materialization receipt belongs to another AutoEssay project");
      }
      state.materializationReceipts[value.id] = value;
      await writeState(state);
    },

    async loadMaterializationReceipt(id) {
      const state = await readState();
      const value = state?.materializationReceipts[id];
      return value === undefined ? undefined : clone(value);
    },

    async listMaterializationReceipts() {
      const state = await readState();
      if (state === undefined) return [];
      return Object.values(state.materializationReceipts)
        .map((value) => clone(value))
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
    },
  };
}

export type BootstrapAutoEssayCollaborativeCoreInput = {
  autoEssayProjectId: string;
  manuscript: Manuscript;
  draftUnits: DraftUnit[];
  store: AutoEssayCollaborativeCoreStore;
};

export type BootstrapAutoEssayCollaborativeCoreResult = {
  projectLink: AutoEssayCollaborativeProjectLink;
  graph: RevisionGraph;
  manuscript: LiteraryManuscript;
  projectionLinks: CanonicalProjectionLink[];
};

export async function bootstrapAutoEssayCollaborativeCore(
  input: BootstrapAutoEssayCollaborativeCoreInput
): Promise<BootstrapAutoEssayCollaborativeCoreResult> {
  const coreProjectId = `autoessay:${input.autoEssayProjectId}`;
  const existingLink = await input.store.loadProjectLink();
  if (existingLink !== undefined) {
    const graph = await input.store.loadRevisionGraph(existingLink.coreProjectId);
    if (graph === undefined) throw new Error("collaborative project link exists without revision graph");
    const manuscript = await input.store.loadCurrentManuscript(
      existingLink.coreProjectId,
      existingLink.canonicalBranchId
    );
    if (manuscript === undefined) throw new Error("collaborative project link exists without canonical snapshot");
    return {
      projectLink: existingLink,
      graph,
      manuscript,
      projectionLinks: await input.store.listProjectionLinks(),
    };
  }

  const projected = projectAutoEssayManuscriptToCollaborativeCore({
    manuscript: input.manuscript,
    draftUnits: input.draftUnits,
    contentCreatedBy: { id: "autoessay-canonical" },
  });
  const canonicalBranchId = "canonical";
  const initialRevisionId = `bootstrap:${input.manuscript.id}`;
  const graph = createRevisionGraph({
    projectId: coreProjectId,
    branchId: canonicalBranchId,
    revisionId: initialRevisionId,
    author: { id: "autoessay-canonical" },
    createdAt: input.manuscript.updatedAt,
  });

  await input.store.initializeProject({
    graph,
    manuscript: projected.manuscript,
    contentVersions: projected.contentVersions,
  });

  const projectLink = AutoEssayCollaborativeProjectLinkSchema.parse({
    autoEssayProjectId: input.autoEssayProjectId,
    coreProjectId,
    canonicalBranchId,
  });
  await input.store.saveProjectLink(projectLink);

  const unitById = new Map(input.draftUnits.map((unit) => [unit.id, unit]));
  const contentByNodeVersion = new Map(
    projected.contentVersions.map((version) => [`${version.nodeId}@${version.version}`, version])
  );
  const projectionLinks: CanonicalProjectionLink[] = [];

  for (const node of Object.values(projected.manuscript.nodes)) {
    if (node.contentRef === undefined) continue;
    const unitRef = node.domainRefs.find((ref) => ref.kind === "autoessay.draft-unit");
    if (unitRef === undefined) {
      throw new Error(`projected content node '${node.id}' has no AutoEssay DraftUnit reference`);
    }
    const unit = unitById.get(unitRef.id);
    if (unit === undefined) throw new Error(`projected DraftUnit not supplied: ${unitRef.id}`);
    const contentVersion = contentByNodeVersion.get(`${node.contentRef.nodeId}@${node.contentRef.version}`);
    if (contentVersion === undefined) {
      throw new Error(`projected ContentVersion not supplied: ${node.contentRef.nodeId}@${node.contentRef.version}`);
    }
    const link = CanonicalProjectionLinkSchema.parse({
      literaryNodeId: node.id,
      autoEssay: {
        unitId: unit.id,
        unitVersion: unit.version,
        contentHash: contentVersion.contentHash,
      },
      coreContentVersion: node.contentRef,
      coreRevisionId: initialRevisionId,
    });
    await input.store.saveProjectionLink(link);
    projectionLinks.push(link);
  }

  projectionLinks.sort((left, right) => left.literaryNodeId.localeCompare(right.literaryNodeId));
  return {
    projectLink,
    graph,
    manuscript: projected.manuscript,
    projectionLinks,
  };
}
