import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import {
  PlanningGapSchema,
  PlanningHypothesisSchema,
  PlanningScopeRefSchema,
  PlanningStructuralChangeSchema,
  PlanningArchitectureProposalSchema,
  applyApprovedPlanningDiff,
  assessPlanningReadiness,
  createPlanningBriefFromSubject,
  proposeAdaptiveDecomposition,
  proposePlanningSubjects,
  refineExistingPlan,
  supersedePlanningBrief,
  type PlanningBrief,
  type PlanningReadinessContext,
  type PlanningSubjectProposal,
  type StructuredModelClient,
} from "@auto-essay/core";
import type { ModelClientFactory } from "../llm/client.js";
import { StructuredClientAdapter } from "../llm/structuredAdapter.js";
import { getProject } from "../services/projectStore.js";
import { listSources } from "../services/sourceStore.js";
import {
  getWorkspace,
  listPlanningBriefs,
  mutateWorkspace,
  savePlanningBrief,
} from "../services/editorialWorkspaceStore.js";

const ReadinessContextSchema = z.object({
  parentRoleKnown: z.boolean().optional(),
  relevantPassageCount: z.number().int().nonnegative().optional(),
  openAuthorDecisions: z.array(z.string().min(1)).optional(),
  blockingSourceGaps: z.array(z.string().min(1)).optional(),
  canJustifyDecomposition: z.boolean().optional(),
});
const SubjectSchema = z.object({
  title: z.string().min(1),
  question: z.string().min(1),
  angle: z.string().min(1),
  hypotheses: z.array(z.string().min(1)).min(1),
  distinctiveness: z.string().min(1),
  evidence: z.array(z.object({
    passageId: z.string().min(1),
    sourceId: z.string().min(1),
    role: z.enum(["supports", "contests", "context"]),
  })),
  limits: z.array(z.string().min(1)).default([]),
  status: z.enum(["emergent", "supported", "contested", "under_documented"]),
});
const BriefChangesSchema = z.object({
  question: z.string().min(1).optional(),
  intention: z.string().min(1).optional(),
  angleOrFunction: z.string().min(1).optional(),
  hypotheses: z.array(PlanningHypothesisSchema).optional(),
  gaps: z.array(PlanningGapSchema).optional(),
  constraints: z.array(z.string().min(1)).optional(),
  sourceRefs: z.array(z.string().min(1)).optional(),
  rationale: z.string().min(1).optional(),
});
const ApprovedDiffSchema = z.object({
  authorApproved: z.literal(true),
  changes: z.array(PlanningStructuralChangeSchema),
});

export function planningRoutes(modelClientFactory: ModelClientFactory): Hono {
  const app = new Hono();

  app.get("/state", async (c) => {
    const projectId = c.req.param("projectId") as string;
    await getProject(projectId);
    const workspace = await getWorkspace(projectId);
    const briefs = await listPlanningBriefs(projectId);
    const scopeKind = c.req.query("scopeKind") ?? "manuscript";
    const scopeId = c.req.query("scopeId");
    const matching = briefs
      .filter((brief) => scopeMatches(brief, scopeKind, scopeId))
      .sort((a, b) => b.version - a.version);
    const activeBrief = matching[0];
    const readiness = activeBrief
      ? assessPlanningReadiness(activeBrief, {
          parentRoleKnown: activeBrief.scopeRef.kind === "manuscript" ? true : undefined,
        })
      : undefined;
    const sources = await listSources(projectId);
    const representedSources = sources.filter((source) => source.content.trim().length > 0);
    return c.json({
      manuscriptId: workspace.manuscript.id,
      mode: hasExistingPlan(workspace.manuscript.tree) ? "existing_plan" : "from_zero",
      activeBrief,
      readiness,
      coverage: {
        registeredSourceCount: sources.length,
        representedSourceCount: representedSources.length,
        explorationComplete: false,
        note: "La couverture décrit les contenus actuellement extraits. Elle ne prouve jamais l’absence dans le corpus.",
      },
    });
  });

  app.post("/explore", async (c) => {
    const projectId = c.req.param("projectId") as string;
    await getProject(projectId);
    const body = z.object({ cadrage: z.string().min(1).optional() }).parse(await c.req.json());
    const sources = await listSources(projectId);
    const passages = sources
      .filter((source) => source.content.trim().length > 0)
      .map((source) => ({
        id: `source:${source.id}:content`,
        sourceId: source.id,
        text: source.content,
        locator: source.pageRange,
      }));
    if (passages.length === 0) {
      throw new HTTPException(400, { message: "Aucun contenu documentaire extrait n’est disponible pour explorer le corpus." });
    }
    const exploration = await proposePlanningSubjects(
      {
        registeredSourceCount: sources.length,
        exploredSourceIds: [...new Set(passages.map((passage) => passage.sourceId))],
        explorationComplete: false,
        passages,
      },
      await makeClient(modelClientFactory),
      body.cadrage
    );
    return c.json(exploration);
  });

  app.post("/refine", async (c) => {
    const projectId = c.req.param("projectId") as string;
    await getProject(projectId);
    const workspace = await getWorkspace(projectId);
    const result = await refineExistingPlan(
      { manuscript: workspace.manuscript },
      await makeClient(modelClientFactory)
    );
    return c.json(result);
  });

  app.post("/briefs/from-subject", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const body = z.object({
      scopeRef: PlanningScopeRefSchema,
      subject: SubjectSchema,
    }).parse(await c.req.json());
    const workspace = await getWorkspace(projectId);
    const brief = createPlanningBriefFromSubject({
      manuscript: workspace.manuscript,
      scopeRef: body.scopeRef,
      subject: body.subject as PlanningSubjectProposal,
    });
    return c.json({ brief: await savePlanningBrief(projectId, brief) }, 201);
  });

  app.post("/briefs/:briefId/supersede", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const changes = BriefChangesSchema.parse(await c.req.json());
    const workspace = await getWorkspace(projectId);
    const current = latestBrief(await listPlanningBriefs(projectId), c.req.param("briefId") as string);
    const brief = supersedePlanningBrief(current, workspace.manuscript, changes);
    return c.json({ brief: await savePlanningBrief(projectId, brief) }, 201);
  });

  app.post("/readiness", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const body = z.object({
      briefId: z.string().min(1),
      context: ReadinessContextSchema.optional(),
    }).parse(await c.req.json());
    const brief = latestBrief(await listPlanningBriefs(projectId), body.briefId);
    return c.json(assessPlanningReadiness(brief, (body.context ?? {}) as PlanningReadinessContext));
  });

  app.post("/decompose", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const body = z.object({ briefId: z.string().min(1) }).parse(await c.req.json());
    const brief = latestBrief(await listPlanningBriefs(projectId), body.briefId);
    const proposal = await proposeAdaptiveDecomposition(brief, await makeClient(modelClientFactory));
    return c.json(proposal);
  });

  app.post("/diff", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const body = z.object({
      briefId: z.string().min(1),
      architecture: PlanningArchitectureProposalSchema,
    }).parse(await c.req.json());
    const workspace = await getWorkspace(projectId);
    const brief = latestBrief(await listPlanningBriefs(projectId), body.briefId);
    if (brief.scopeRef.kind === "plan_entry") {
      throw new HTTPException(400, { message: "Un paragraphe planifié est déjà un scope terminal pour la décomposition." });
    }
    const parentNodeId = brief.scopeRef.kind === "node" ? brief.scopeRef.nodeId : null;
    const startIndex = childCount(workspace.manuscript.tree, parentNodeId);
    if (startIndex < 0) {
      throw new HTTPException(409, { message: "Le scope du brief n’existe plus dans le manuscrit." });
    }
    return c.json({
      changes: body.architecture.children.map((child, index) => ({
        id: crypto.randomUUID(),
        kind: "create_node" as const,
        parentNodeId,
        index: startIndex + index,
        node: { id: crypto.randomUUID(), title: child.title },
        reason: child.rationale,
        consequences: child.hypothesisTreatments.map((treatment) => treatment.rationale),
      })),
    });
  });

  app.post("/apply", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const approvedDiff = ApprovedDiffSchema.parse(await c.req.json());
    const result = await mutateWorkspace(projectId, (workspace) => {
      const applied = applyApprovedPlanningDiff({
        manuscript: workspace.manuscript,
        briefs: workspace.planningBriefs,
        approvedDiff,
      });
      workspace.manuscript = applied.manuscript;
      workspace.planningBriefs = applied.briefs;
      return applied;
    });
    return c.json(result);
  });

  return app;
}

async function makeClient(modelClientFactory: ModelClientFactory): Promise<StructuredModelClient> {
  return new StructuredClientAdapter(await modelClientFactory());
}

function latestBrief(briefs: PlanningBrief[], id: string): PlanningBrief {
  const direct = briefs.find((brief) => brief.id === id);
  if (!direct) throw new HTTPException(404, { message: "planning brief not found" });
  return briefs
    .filter((brief) => sameScope(brief, direct))
    .sort((a, b) => b.version - a.version)[0] ?? direct;
}

function sameScope(a: PlanningBrief, b: PlanningBrief): boolean {
  return JSON.stringify(a.scopeRef) === JSON.stringify(b.scopeRef);
}

function scopeMatches(brief: PlanningBrief, kind: string, scopeId?: string): boolean {
  if (kind === "manuscript") return brief.scopeRef.kind === "manuscript";
  if (kind === "node") return brief.scopeRef.kind === "node" && brief.scopeRef.nodeId === scopeId;
  if (kind === "plan_entry") return brief.scopeRef.kind === "plan_entry" && brief.scopeRef.planEntryId === scopeId;
  return false;
}

function hasExistingPlan(children: Array<{ kind: string; plan?: unknown[]; children?: unknown[] }>): boolean {
  return children.some((child) =>
    child.kind === "node" && ((child.plan?.length ?? 0) > 0 || hasExistingPlan((child.children ?? []) as Array<{ kind: string; plan?: unknown[]; children?: unknown[] }>))
  );
}

function childCount(children: Array<{ kind: string; id?: string; children?: unknown[] }>, parentNodeId: string | null): number {
  if (parentNodeId === null) return children.length;
  for (const child of children) {
    if (child.kind !== "node") continue;
    if (child.id === parentNodeId) return (child.children ?? []).length;
    const nested = childCount((child.children ?? []) as Array<{ kind: string; id?: string; children?: unknown[] }>, parentNodeId);
    if (nested >= 0) return nested;
  }
  return -1;
}
