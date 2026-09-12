import { z } from "zod";
import {
  ManuscriptSchema,
  createManuscriptNode,
  createPlanNote,
  type Manuscript,
  type ManuscriptChild,
  type ManuscriptNode,
} from "../domain/manuscript.js";
import {
  PlanningBriefSchema,
  supersedePlanningBrief,
  type PlanningBrief,
} from "../domain/planningBrief.js";

export const PlanningStructuralChangeKindSchema = z.enum([
  "create_node",
  "rename_node",
  "move_node",
  "split_node",
  "merge_nodes",
  "update_brief",
  "add_unresolved_branch",
]);
export type PlanningStructuralChangeKind = z.infer<
  typeof PlanningStructuralChangeKindSchema
>;

const ChangeBaseSchema = z.object({
  id: z.string().min(1),
  reason: z.string().min(1),
  consequences: z.array(z.string().min(1)).default([]),
});

const CreateNodeChangeSchema = ChangeBaseSchema.extend({
  kind: z.literal("create_node"),
  parentNodeId: z.string().min(1).nullable(),
  index: z.number().int().nonnegative(),
  node: z.object({ id: z.string().min(1), title: z.string().min(1) }),
});

const RenameNodeChangeSchema = ChangeBaseSchema.extend({
  kind: z.literal("rename_node"),
  nodeId: z.string().min(1),
  title: z.string().min(1),
});

const MoveNodeChangeSchema = ChangeBaseSchema.extend({
  kind: z.literal("move_node"),
  nodeId: z.string().min(1),
  parentNodeId: z.string().min(1).nullable(),
  index: z.number().int().nonnegative(),
});

const SplitNodeChangeSchema = ChangeBaseSchema.extend({
  kind: z.literal("split_node"),
  nodeId: z.string().min(1),
  replacements: z
    .array(z.object({ id: z.string().min(1), title: z.string().min(1) }))
    .min(2),
});

const MergeNodesChangeSchema = ChangeBaseSchema.extend({
  kind: z.literal("merge_nodes"),
  nodeIds: z.array(z.string().min(1)).min(2),
  mergedNode: z.object({ id: z.string().min(1), title: z.string().min(1) }),
});

const UpdateBriefChangeSchema = ChangeBaseSchema.extend({
  kind: z.literal("update_brief"),
  briefId: z.string().min(1),
  changes: z.object({
    question: z.string().min(1).optional(),
    intention: z.string().min(1).optional(),
    angleOrFunction: z.string().min(1).optional(),
    constraints: z.array(z.string().min(1)).optional(),
    sourceRefs: z.array(z.string().min(1)).optional(),
    rationale: z.string().min(1).optional(),
  }),
});

const AddUnresolvedBranchChangeSchema = ChangeBaseSchema.extend({
  kind: z.literal("add_unresolved_branch"),
  parentNodeId: z.string().min(1).nullable(),
  index: z.number().int().nonnegative(),
  node: z.object({ id: z.string().min(1), title: z.string().min(1) }),
  missingEvidence: z.string().min(1),
});

export const PlanningStructuralChangeSchema = z.discriminatedUnion("kind", [
  CreateNodeChangeSchema,
  RenameNodeChangeSchema,
  MoveNodeChangeSchema,
  SplitNodeChangeSchema,
  MergeNodesChangeSchema,
  UpdateBriefChangeSchema,
  AddUnresolvedBranchChangeSchema,
]);
export type PlanningStructuralChange = z.infer<typeof PlanningStructuralChangeSchema>;

export interface PlanningStructuralDiff {
  changes: PlanningStructuralChange[];
}

export interface ApprovedPlanningDiff {
  authorApproved: true;
  changes: PlanningStructuralChange[];
}

export function approveAllPlanningChanges(
  diff: PlanningStructuralDiff
): ApprovedPlanningDiff {
  return { authorApproved: true, changes: diff.changes.map((change) => PlanningStructuralChangeSchema.parse(change)) };
}

export function rejectAllPlanningChanges(): { authorApproved: false; changes: [] } {
  return { authorApproved: false, changes: [] };
}

export function approveSelectedPlanningChanges(
  diff: PlanningStructuralDiff,
  selectedChangeIds: string[],
  edits: Record<string, PlanningStructuralChange> = {}
): ApprovedPlanningDiff {
  const selected = new Set(selectedChangeIds);
  const changes = diff.changes
    .filter((change) => selected.has(change.id))
    .map((change) => PlanningStructuralChangeSchema.parse(edits[change.id] ?? change));
  if (changes.length !== selected.size) {
    throw new Error("Approved planning diff references an unknown change id");
  }
  return { authorApproved: true, changes };
}

export function describePlanningChange(change: PlanningStructuralChange): {
  before: string;
  after: string;
  reason: string;
  consequences: string[];
} {
  switch (change.kind) {
    case "create_node":
      return { before: "absent", after: `create ${change.node.title} (${change.node.id})`, reason: change.reason, consequences: change.consequences };
    case "rename_node":
      return { before: `node ${change.nodeId}`, after: `rename to ${change.title}`, reason: change.reason, consequences: change.consequences };
    case "move_node":
      return { before: `node ${change.nodeId} at current position`, after: `move under ${change.parentNodeId ?? "manuscript root"} at ${change.index}`, reason: change.reason, consequences: change.consequences };
    case "split_node":
      return { before: `node ${change.nodeId}`, after: `split into ${change.replacements.map((node) => node.title).join(" | ")}`, reason: change.reason, consequences: change.consequences };
    case "merge_nodes":
      return { before: `nodes ${change.nodeIds.join(", ")}`, after: `merge into ${change.mergedNode.title} (${change.mergedNode.id})`, reason: change.reason, consequences: change.consequences };
    case "update_brief":
      return { before: `planning brief ${change.briefId}`, after: "superseded planning brief", reason: change.reason, consequences: change.consequences };
    case "add_unresolved_branch":
      return { before: "absent", after: `unresolved branch ${change.node.title}: missing ${change.missingEvidence}`, reason: change.reason, consequences: change.consequences };
  }
}

export interface ApplyApprovedPlanningDiffInput {
  manuscript: Manuscript;
  briefs: PlanningBrief[];
  approvedDiff: ApprovedPlanningDiff | { authorApproved: false; changes: [] };
}

export interface ApplyApprovedPlanningDiffResult {
  manuscript: Manuscript;
  briefs: PlanningBrief[];
  appliedChangeIds: string[];
}

/**
 * Domain-level atomic boundary: all work happens against parsed copies. The
 * caller receives a replacement state only after every approved operation and
 * every schema invariant succeeds. No persistence or Writing Engine dual-write.
 */
export function applyApprovedPlanningDiff(
  input: ApplyApprovedPlanningDiffInput
): ApplyApprovedPlanningDiffResult {
  if (!input.approvedDiff.authorApproved) {
    return { manuscript: input.manuscript, briefs: input.briefs, appliedChangeIds: [] };
  }

  let manuscript = ManuscriptSchema.parse(input.manuscript);
  let briefs = input.briefs.map((brief) => PlanningBriefSchema.parse(brief));
  const appliedChangeIds: string[] = [];

  for (const rawChange of input.approvedDiff.changes) {
    const change = PlanningStructuralChangeSchema.parse(rawChange);
    if (change.kind === "update_brief") {
      const index = briefs.findIndex((brief) => brief.id === change.briefId);
      if (index < 0) throw new Error(`Unknown planning brief: ${change.briefId}`);
      const current = briefs[index]!;
      const next = supersedePlanningBrief(current, manuscript, change.changes);
      briefs = [...briefs.slice(0, index), next, ...briefs.slice(index + 1)];
    } else {
      manuscript = applyStructuralChange(manuscript, change);
    }
    appliedChangeIds.push(change.id);
  }

  manuscript = ManuscriptSchema.parse({
    ...manuscript,
    updatedAt: new Date().toISOString(),
  });
  briefs = briefs.map((brief) => PlanningBriefSchema.parse(brief));
  return { manuscript, briefs, appliedChangeIds };
}

function applyStructuralChange(
  manuscript: Manuscript,
  change: Exclude<PlanningStructuralChange, z.infer<typeof UpdateBriefChangeSchema>>
): Manuscript {
  let tree = manuscript.tree;
  switch (change.kind) {
    case "create_node": {
      const node = createManuscriptNode({ id: change.node.id, title: change.node.title });
      tree = insertNode(tree, change.parentNodeId, change.index, node);
      break;
    }
    case "add_unresolved_branch": {
      const node = createManuscriptNode({
        id: change.node.id,
        title: change.node.title,
        notes: [
          createPlanNote(
            "agent",
            `UNRESOLVED — missing evidence: ${change.missingEvidence}`
          ),
        ],
      });
      tree = insertNode(tree, change.parentNodeId, change.index, node);
      break;
    }
    case "rename_node":
      tree = mapNode(tree, change.nodeId, (node) => ({ ...node, title: change.title }));
      break;
    case "move_node": {
      const removed = removeNode(tree, change.nodeId);
      if (!removed.node) throw new Error(`Unknown manuscript node: ${change.nodeId}`);
      if (change.parentNodeId === change.nodeId || containsNode(removed.node.children, change.parentNodeId)) {
        throw new Error("Cannot move a node below itself or one of its descendants");
      }
      tree = insertNode(removed.tree, change.parentNodeId, change.index, removed.node);
      break;
    }
    case "split_node": {
      const located = findNodeWithContainer(tree, change.nodeId);
      if (!located) throw new Error(`Unknown manuscript node: ${change.nodeId}`);
      if (located.node.children.length > 0 || located.node.plan?.length || located.node.text?.trim()) {
        throw new Error("split_node currently requires a structurally empty planning node");
      }
      const replacements = change.replacements.map((replacement) =>
        createManuscriptNode({ id: replacement.id, title: replacement.title })
      );
      tree = replaceNodesAtContainer(tree, located.parentNodeId, located.index, 1, replacements);
      break;
    }
    case "merge_nodes": {
      const locations = change.nodeIds.map((nodeId) => findNodeWithContainer(tree, nodeId));
      if (locations.some((location) => !location)) throw new Error("merge_nodes references an unknown node");
      const resolved = locations as NonNullable<(typeof locations)[number]>[];
      const parentNodeId = resolved[0]!.parentNodeId;
      if (resolved.some((location) => location.parentNodeId !== parentNodeId)) {
        throw new Error("merge_nodes requires sibling nodes");
      }
      const indexes = resolved.map((location) => location.index).sort((a, b) => a - b);
      for (let i = 1; i < indexes.length; i += 1) {
        if (indexes[i] !== indexes[0]! + i) throw new Error("merge_nodes requires contiguous sibling nodes");
      }
      const mergedChildren = resolved.flatMap((location) => location.node.children);
      const merged = createManuscriptNode({
        id: change.mergedNode.id,
        title: change.mergedNode.title,
        children: mergedChildren,
      });
      tree = replaceNodesAtContainer(tree, parentNodeId, indexes[0]!, indexes.length, [merged]);
      break;
    }
  }
  return ManuscriptSchema.parse({ ...manuscript, tree });
}

function mapNode(
  children: ManuscriptChild[],
  nodeId: string,
  transform: (node: ManuscriptNode) => ManuscriptNode
): ManuscriptChild[] {
  let found = false;
  const visit = (child: ManuscriptChild): ManuscriptChild => {
    if (child.kind === "leaf") return child;
    if (child.id === nodeId) {
      found = true;
      return transform(child);
    }
    return { ...child, children: child.children.map(visit) };
  };
  const next = children.map(visit);
  if (!found) throw new Error(`Unknown manuscript node: ${nodeId}`);
  return next;
}

function removeNode(
  children: ManuscriptChild[],
  nodeId: string
): { tree: ManuscriptChild[]; node?: ManuscriptNode } {
  let removed: ManuscriptNode | undefined;
  const visit = (items: ManuscriptChild[]): ManuscriptChild[] => {
    const out: ManuscriptChild[] = [];
    for (const child of items) {
      if (child.kind === "node" && child.id === nodeId) {
        if (removed) throw new Error(`Duplicate manuscript node id: ${nodeId}`);
        removed = child;
        continue;
      }
      if (child.kind === "node") out.push({ ...child, children: visit(child.children) });
      else out.push(child);
    }
    return out;
  };
  return { tree: visit(children), node: removed };
}

function insertNode(
  children: ManuscriptChild[],
  parentNodeId: string | null,
  index: number,
  node: ManuscriptNode
): ManuscriptChild[] {
  if (parentNodeId === null) {
    if (index > children.length) throw new Error("Insert index exceeds manuscript root size");
    return [...children.slice(0, index), node, ...children.slice(index)];
  }
  return mapNode(children, parentNodeId, (parent) => {
    if (index > parent.children.length) throw new Error(`Insert index exceeds children of ${parentNodeId}`);
    return {
      ...parent,
      children: [...parent.children.slice(0, index), node, ...parent.children.slice(index)],
    };
  });
}

function containsNode(children: ManuscriptChild[], nodeId: string | null): boolean {
  if (nodeId === null) return false;
  for (const child of children) {
    if (child.kind === "node") {
      if (child.id === nodeId || containsNode(child.children, nodeId)) return true;
    }
  }
  return false;
}

function findNodeWithContainer(
  children: ManuscriptChild[],
  nodeId: string,
  parentNodeId: string | null = null
): { node: ManuscriptNode; parentNodeId: string | null; index: number } | undefined {
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index]!;
    if (child.kind === "leaf") continue;
    if (child.id === nodeId) return { node: child, parentNodeId, index };
    const nested = findNodeWithContainer(child.children, nodeId, child.id);
    if (nested) return nested;
  }
  return undefined;
}

function replaceNodesAtContainer(
  tree: ManuscriptChild[],
  parentNodeId: string | null,
  index: number,
  deleteCount: number,
  replacements: ManuscriptNode[]
): ManuscriptChild[] {
  if (parentNodeId === null) {
    return [...tree.slice(0, index), ...replacements, ...tree.slice(index + deleteCount)];
  }
  return mapNode(tree, parentNodeId, (parent) => ({
    ...parent,
    children: [
      ...parent.children.slice(0, index),
      ...replacements,
      ...parent.children.slice(index + deleteCount),
    ],
  }));
}
