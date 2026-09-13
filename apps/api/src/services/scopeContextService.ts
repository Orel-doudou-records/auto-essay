import { HTTPException } from "hono/http-exception";
import {
  supersedePlanningBrief,
  type DraftUnit,
  type EditorialDecision,
  type ManuscriptChild,
  type ManuscriptNode,
  type PlanningBrief,
  type Source,
  type SourceProfile,
} from "@auto-essay/core";
import {
  getWorkspace,
  listPlanningBriefs,
  savePlanningBrief,
} from "./editorialWorkspaceStore.js";
import { getSource, listSources } from "./sourceStore.js";
import { getUnit, updateUnit } from "./unitStore.js";

export type WorkspaceScope = {
  kind: "node" | "unit";
  id: string;
};

type SourceExplorationState =
  | "explored"
  | "partial"
  | "registered_unexplored"
  | "unusable";

export async function getScopeContext(projectId: string, scope: WorkspaceScope) {
  const [workspace, sources, briefs] = await Promise.all([
    getWorkspace(projectId),
    listSources(projectId),
    listPlanningBriefs(projectId),
  ]);
  const profileBySourceId = new Map(
    workspace.profiles.map((profile) => [profile.sourceId, profile] as const)
  );

  if (scope.kind === "node") {
    const path = findNodePath(workspace.manuscript.tree, scope.id);
    const node = path.at(-1);
    if (!node) throw new HTTPException(404, { message: "manuscript node not found" });

    const activeBrief = latestBriefForNode(briefs, node.id);
    const includedSourceIds = new Set(
      activeBrief?.sourceRefs ??
        workspace.distribution
          .filter((entry) => entry.scopeId === node.id)
          .map((entry) => entry.sourceId)
    );
    const sourceViews = sources.map((source) =>
      toSourceView(source, profileBySourceId.get(source.id), includedSourceIds.has(source.id))
    );

    return {
      scope,
      text: node.text ?? "",
      planning: activeBrief ? toPlanningView(activeBrief) : null,
      decisions: applicableDecisions(workspace.decisions, path.map((item) => item.id), []),
      sources: sourceViews,
      passages: [],
      exploration: explorationView(sourceViews, activeBrief),
      sourceSelection: {
        editable: Boolean(activeBrief),
        authority: activeBrief ? "planning_brief" as const : "legacy_or_none" as const,
      },
    };
  }

  const unit = await getUnit(projectId, scope.id);
  if (!unit) throw new HTTPException(404, { message: "draft unit not found" });
  const placement = findUnitPlacement(workspace.manuscript.tree, unit.id);
  const activeBrief = latestBriefForUnit(briefs, unit, placement);
  const includedSourceIds = new Set(unit.evidencePack.sourceIds);
  const sourceViews = sources.map((source) =>
    toSourceView(source, profileBySourceId.get(source.id), includedSourceIds.has(source.id))
  );

  return {
    scope,
    text: unit.content,
    planning: activeBrief ? toPlanningView(activeBrief) : null,
    decisions: applicableDecisions(
      workspace.decisions,
      placement.nodePath.map((item) => item.id),
      unit.appliedDecisionIds
    ),
    sources: sourceViews,
    passages: unit.evidencePack.keyCitations.map((citation) => ({
      sourceId: citation.sourceId,
      text: citation.quote,
      pageRange: citation.pageRange,
      context: citation.context,
    })),
    exploration: explorationView(sourceViews, activeBrief),
    sourceSelection: {
      editable: true,
      authority: "evidence_pack" as const,
    },
  };
}

export async function setScopeSourceIncluded(
  projectId: string,
  scope: WorkspaceScope,
  sourceId: string,
  included: boolean
) {
  const source = await getSource(projectId, sourceId);
  if (!source) throw new HTTPException(404, { message: "source not found" });

  if (scope.kind === "unit") {
    const unit = await getUnit(projectId, scope.id);
    if (!unit) throw new HTTPException(404, { message: "draft unit not found" });
    const sourceIds = toggleId(unit.evidencePack.sourceIds, sourceId, included);
    const evidencePack = included
      ? { ...unit.evidencePack, sourceIds }
      : {
          ...unit.evidencePack,
          sourceIds,
          keyCitations: unit.evidencePack.keyCitations.filter((item) => item.sourceId !== sourceId),
          objections: unit.evidencePack.objections.filter((item) => item.sourceId !== sourceId),
        };
    await updateUnit(projectId, unit.id, { evidencePack });
    return getScopeContext(projectId, scope);
  }

  const workspace = await getWorkspace(projectId);
  const node = findNodePath(workspace.manuscript.tree, scope.id).at(-1);
  if (!node) throw new HTTPException(404, { message: "manuscript node not found" });
  const briefs = await listPlanningBriefs(projectId);
  const current = latestBriefForNode(briefs, node.id);
  if (!current) {
    throw new HTTPException(409, {
      message: "Ce scope doit d’abord avoir un cadrage actif avant de modifier ses sources.",
    });
  }

  const sourceRefs = toggleId(current.sourceRefs, sourceId, included);
  if (sameIds(sourceRefs, current.sourceRefs)) return getScopeContext(projectId, scope);
  const hypotheses = included
    ? current.hypotheses
    : current.hypotheses.map((hypothesis) => ({
        ...hypothesis,
        sourceRefs: hypothesis.sourceRefs.filter((id) => id !== sourceId),
      }));
  const next = supersedePlanningBrief(current, workspace.manuscript, { sourceRefs, hypotheses });
  await savePlanningBrief(projectId, next);
  return getScopeContext(projectId, scope);
}

function toSourceView(source: Source, profile: SourceProfile | undefined, included: boolean) {
  const state = sourceState(profile);
  return {
    id: source.id,
    title: source.title,
    authors: source.authors,
    included,
    state,
    subjects: profile?.subjects ?? [],
    concepts: profile?.concepts ?? [],
    abstract: profile?.abstract,
    coverage: profile?.comprehension
      ? {
          coveredBlocks: profile.comprehension.coveredBlockIds.length,
          totalBlocks: profile.comprehension.totalBlocks,
        }
      : null,
  };
}

function sourceState(profile: SourceProfile | undefined): SourceExplorationState {
  if (profile?.comprehension?.status === "ready") return "explored";
  if (profile?.comprehension?.status === "degraded") return "partial";
  if (profile?.comprehension?.status === "unreadable") return "unusable";
  return "registered_unexplored";
}

function explorationView(
  sources: Array<{ included: boolean; state: SourceExplorationState }>,
  brief: PlanningBrief | undefined
) {
  const hasIncludedSources = sources.some((source) => source.included);
  const complete = false;
  return {
    complete,
    status: hasIncludedSources
      ? "has_context" as const
      : sources.length === 0
        ? "empty_library" as const
        : "incomplete" as const,
    gaps: brief?.gaps.map((gap) => ({
      description: gap.description,
      consequence: gap.consequence,
      neededEvidence: gap.neededEvidence,
    })) ?? [],
    underDocumentedHypotheses: brief?.hypotheses
      .filter((hypothesis) => hypothesis.status === "under_documented")
      .map((hypothesis) => hypothesis.statement) ?? [],
  };
}

function toPlanningView(brief: PlanningBrief) {
  return {
    id: brief.id,
    version: brief.version,
    question: brief.question,
    intention: brief.intention,
    angleOrFunction: brief.angleOrFunction,
    constraints: brief.constraints,
  };
}

function applicableDecisions(
  decisions: EditorialDecision[],
  relatedNodeIds: string[],
  appliedDecisionIds: string[]
) {
  const related = new Set(relatedNodeIds);
  const applied = new Set(appliedDecisionIds);
  return decisions
    .filter((decision) =>
      decision.status === "active" &&
      (
        applied.has(decision.id) ||
        decision.scope.level === "project" ||
        Boolean(decision.scope.sectionId && related.has(decision.scope.sectionId)) ||
        Boolean(decision.scope.paragraphId && related.has(decision.scope.paragraphId))
      )
    )
    .map((decision) => ({
      id: decision.id,
      contentCommitments: decision.contentCommitments,
      formalCommitments: decision.formalCommitments,
      invariants: decision.invariants,
      prohibitedShortcuts: decision.prohibitedShortcuts,
      validatedAt: decision.validation.validatedAt,
    }));
}

function latestBriefForNode(briefs: PlanningBrief[], nodeId: string): PlanningBrief | undefined {
  return briefs
    .filter((brief) => brief.scopeRef.kind === "node" && brief.scopeRef.nodeId === nodeId)
    .sort((left, right) => right.version - left.version)[0];
}

function latestBriefForUnit(
  briefs: PlanningBrief[],
  unit: DraftUnit,
  placement: { nodePath: ManuscriptNode[]; planEntryId?: string }
): PlanningBrief | undefined {
  if (placement.planEntryId) {
    const planEntryBrief = briefs
      .filter(
        (brief) =>
          brief.scopeRef.kind === "plan_entry" &&
          brief.scopeRef.planEntryId === placement.planEntryId
      )
      .sort((left, right) => right.version - left.version)[0];
    if (planEntryBrief) return planEntryBrief;
  }

  for (const node of [...placement.nodePath].reverse()) {
    const nodeBrief = latestBriefForNode(briefs, node.id);
    if (nodeBrief) return nodeBrief;
  }

  const sectionId = unit.contextInPlan?.section;
  return sectionId ? latestBriefForNode(briefs, sectionId) : undefined;
}

function findNodePath(children: ManuscriptChild[], targetId: string): ManuscriptNode[] {
  for (const child of children) {
    if (child.kind === "leaf") continue;
    if (child.id === targetId) return [child];
    const nested = findNodePath(child.children, targetId);
    if (nested.length > 0) return [child, ...nested];
  }
  return [];
}

function findUnitPlacement(
  children: ManuscriptChild[],
  unitId: string,
  path: ManuscriptNode[] = []
): { nodePath: ManuscriptNode[]; planEntryId?: string } {
  for (const child of children) {
    if (child.kind === "leaf") {
      if (child.unitId === unitId) return { nodePath: path };
      continue;
    }
    const nodePath = [...path, child];
    const planEntry = child.plan?.find((entry) => entry.unitId === unitId);
    if (planEntry) return { nodePath, planEntryId: planEntry.id };
    const nested = findUnitPlacement(child.children, unitId, nodePath);
    if (nested.nodePath.length > 0) return nested;
  }
  return { nodePath: [] };
}

function toggleId(ids: string[], id: string, included: boolean): string[] {
  if (included) return ids.includes(id) ? ids : [...ids, id];
  return ids.filter((value) => value !== id);
}

function sameIds(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
