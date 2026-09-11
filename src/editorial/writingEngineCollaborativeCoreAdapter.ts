import {
  LiteraryManuscriptSchema,
  LiteraryScopeSchema,
  createContentVersion,
  type ContentVersion,
  type ContributorRef,
  type DomainEntityRef,
  type LiteraryManuscript,
  type LiteraryNode,
  type LiteraryNodeKind,
  type LiteraryScope,
  type TextRange,
} from "writing-engine";
import type { DraftUnit } from "../domain/draftUnit";
import type {
  Manuscript,
  ManuscriptChild,
  ManuscriptLeaf,
  ManuscriptNode,
  PlanEntry,
} from "../domain/manuscript";

export type AutoEssayCollaborativeCoreProjection = {
  manuscript: LiteraryManuscript;
  contentVersions: ContentVersion[];
};

export type ProjectAutoEssayManuscriptInput = {
  manuscript: Manuscript;
  draftUnits: DraftUnit[];
  contentCreatedBy: ContributorRef;
};

type ProjectionContext = {
  source: Manuscript;
  unitByVersion: Map<string, DraftUnit>;
  nodes: Record<string, LiteraryNode>;
  contentVersions: ContentVersion[];
  contentCreatedBy: ContributorRef;
};

function unitVersionKey(unitId: string, version: number): string {
  return `${unitId}@${version}`;
}

function structuralKind(depth: number): LiteraryNodeKind {
  if (depth === 0) return "chapter";
  if (depth === 1) return "section";
  throw new Error(
    "CC1 compatibility projection supports at most chapter -> section structural nesting before paragraphs"
  );
}

function draftUnitKind(unit: DraftUnit): Exclude<LiteraryNodeKind, "manuscript"> {
  switch (unit.granularity) {
    case "paragraph":
      return "paragraph";
    case "section":
      return "section";
    case "chapter":
      return "chapter";
    case "book":
      throw new Error(
        `AutoEssay DraftUnit '${unit.id}' has book granularity; the CC1 manuscript root already represents the book`
      );
  }
}

function appendRef(
  refs: DomainEntityRef[],
  seen: Set<string>,
  kind: string,
  id: string
): void {
  const key = `${kind}\u0000${id}`;
  if (seen.has(key)) return;
  seen.add(key);
  refs.push({ kind, id });
}

function draftUnitRefs(unit: DraftUnit): DomainEntityRef[] {
  const refs: DomainEntityRef[] = [];
  const seen = new Set<string>();

  appendRef(refs, seen, "autoessay.draft-unit", unit.id);
  for (const id of unit.claimIds) {
    appendRef(refs, seen, "autoessay.claim", id);
  }
  for (const id of unit.appliedDecisionIds) {
    appendRef(refs, seen, "autoessay.editorial-decision", id);
  }
  for (const id of unit.appliedArticulationIds) {
    appendRef(refs, seen, "autoessay.content-style-articulation", id);
  }
  for (const id of unit.transformationTraceIds) {
    appendRef(refs, seen, "autoessay.transformation-trace", id);
  }

  return refs;
}

function addNode(context: ProjectionContext, node: LiteraryNode): void {
  if (context.nodes[node.id] !== undefined) {
    throw new Error(`CC1 literary node id collision: ${node.id}`);
  }
  context.nodes[node.id] = node;
}

function requireDraftUnit(
  context: ProjectionContext,
  leaf: ManuscriptLeaf
): DraftUnit {
  const key = unitVersionKey(leaf.unitId, leaf.version);
  const unit = context.unitByVersion.get(key);
  if (unit === undefined) {
    throw new Error(`AutoEssay DraftUnit version '${key}' is referenced by the manuscript but was not supplied`);
  }
  if (unit.projectId !== context.source.projectId) {
    throw new Error(
      `AutoEssay DraftUnit '${key}' belongs to project '${unit.projectId}', expected '${context.source.projectId}'`
    );
  }
  return unit;
}

function linkedPlanEntry(
  parent: ManuscriptNode | undefined,
  leaf: ManuscriptLeaf
): PlanEntry | undefined {
  const matches = (parent?.plan ?? []).filter(
    (entry) =>
      entry.unitId === leaf.unitId && entry.unitVersion === leaf.version
  );
  if (matches.length > 1) {
    throw new Error(
      `AutoEssay leaf '${unitVersionKey(leaf.unitId, leaf.version)}' is linked from multiple PlanEntry identities in '${parent?.id}'`
    );
  }
  return matches[0];
}

function projectLeaf(
  context: ProjectionContext,
  leaf: ManuscriptLeaf,
  parentId: string,
  parentKind: LiteraryNodeKind,
  parentSource: ManuscriptNode | undefined
): string {
  const unit = requireDraftUnit(context, leaf);
  const planEntry = linkedPlanEntry(parentSource, leaf);
  const literaryId = planEntry?.id ?? unit.id;
  const kind = planEntry === undefined ? draftUnitKind(unit) : "paragraph";

  if (planEntry !== undefined && unit.granularity !== "paragraph") {
    throw new Error(
      `PlanEntry '${planEntry.id}' represents a paragraph but links DraftUnit '${unit.id}' with granularity '${unit.granularity}'`
    );
  }

  const allowedByParent =
    (parentKind === "manuscript" && kind !== "manuscript") ||
    (parentKind === "chapter" && (kind === "section" || kind === "paragraph")) ||
    (parentKind === "section" && kind === "paragraph");
  if (!allowedByParent) {
    throw new Error(
      `Cannot project AutoEssay DraftUnit '${unitVersionKey(unit.id, unit.version)}' as ${kind} under CC1 ${parentKind}`
    );
  }

  addNode(context, {
    id: literaryId,
    kind,
    ...(planEntry?.subject ? { title: planEntry.subject } : {}),
    parentId,
    childIds: [],
    contentRef: { nodeId: literaryId, version: unit.version },
    domainRefs: draftUnitRefs(unit),
    lineage: { derivedFrom: [], supersedes: [] },
    removed: false,
  });

  context.contentVersions.push(
    createContentVersion({
      nodeId: literaryId,
      version: unit.version,
      content: unit.content,
      createdBy: context.contentCreatedBy,
      createdAt: unit.updatedAt,
    })
  );

  return literaryId;
}

function projectStructuralNode(
  context: ProjectionContext,
  sourceNode: ManuscriptNode,
  parentId: string,
  depth: number
): string {
  if (sourceNode.text !== undefined && sourceNode.text.length > 0) {
    throw new Error(
      `AutoEssay structural node '${sourceNode.id}' contains text that the CC1 compatibility projection cannot represent without inventing a content identity`
    );
  }

  const kind = structuralKind(depth);
  const childIds: string[] = [];
  const projectedNode: LiteraryNode = {
    id: sourceNode.id,
    kind,
    title: sourceNode.title,
    parentId,
    childIds,
    domainRefs: [],
    lineage: { derivedFrom: [], supersedes: [] },
    removed: false,
  };
  addNode(context, projectedNode);

  for (const child of sourceNode.children) {
    childIds.push(
      projectChild(context, child, sourceNode.id, kind, depth + 1, sourceNode)
    );
  }

  context.nodes[sourceNode.id] = { ...projectedNode, childIds };
  return sourceNode.id;
}

function projectChild(
  context: ProjectionContext,
  child: ManuscriptChild,
  parentId: string,
  parentKind: LiteraryNodeKind,
  structuralDepth: number,
  parentSource: ManuscriptNode | undefined
): string {
  if (child.kind === "leaf") {
    return projectLeaf(context, child, parentId, parentKind, parentSource);
  }
  return projectStructuralNode(context, child, parentId, structuralDepth);
}

export function projectAutoEssayManuscriptToCollaborativeCore(
  input: ProjectAutoEssayManuscriptInput
): AutoEssayCollaborativeCoreProjection {
  const unitByVersion = new Map<string, DraftUnit>();
  for (const unit of input.draftUnits) {
    const key = unitVersionKey(unit.id, unit.version);
    if (unitByVersion.has(key)) {
      throw new Error(`Duplicate AutoEssay DraftUnit version supplied: ${key}`);
    }
    unitByVersion.set(key, unit);
  }

  const root: LiteraryNode = {
    id: input.manuscript.id,
    kind: "manuscript",
    title: input.manuscript.title,
    childIds: [],
    domainRefs: [{ kind: "autoessay.project", id: input.manuscript.projectId }],
    lineage: { derivedFrom: [], supersedes: [] },
    removed: false,
  };
  const context: ProjectionContext = {
    source: input.manuscript,
    unitByVersion,
    nodes: { [root.id]: root },
    contentVersions: [],
    contentCreatedBy: input.contentCreatedBy,
  };

  const rootChildIds: string[] = [];
  for (const child of input.manuscript.tree) {
    rootChildIds.push(
      projectChild(context, child, root.id, "manuscript", 0, undefined)
    );
  }
  context.nodes[root.id] = { ...root, childIds: rootChildIds };

  const manuscript = LiteraryManuscriptSchema.parse({
    rootId: root.id,
    nodes: context.nodes,
  });

  return {
    manuscript,
    contentVersions: context.contentVersions,
  };
}

export function toCollaborativeCoreScope(
  nodeId: string,
  range?: TextRange
): LiteraryScope {
  return LiteraryScopeSchema.parse({
    nodeId,
    ...(range === undefined ? {} : { range }),
  });
}
