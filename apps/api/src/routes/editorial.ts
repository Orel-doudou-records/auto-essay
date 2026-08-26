import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  createEditorialDecisionService,
  projectBibliography,
  projectBookPlan,
  projectBookState,
  type ContentStyleArticulation,
  type EditorialDecision,
  type ManuscriptChild,
} from "@auto-essay/core";
import type { ModelClientFactory } from "../llm/client.js";
import { StructuredClientAdapter } from "../llm/structuredAdapter.js";
import {
  AcceptProposalBodySchema,
  EditorialWorkspaceBodySchema,
  ModifyProposalBodySchema,
  ReadSectionBodySchema,
  RejectProposalBodySchema,
} from "../schemas/editorial.js";
import { DiffractionService } from "../services/diffractionService.js";
import {
  acceptDecision,
  getWorkspace,
  putWorkspace,
  saveArticulation,
  storeReading,
  updateArticulation,
} from "../services/editorialWorkspaceStore.js";
import { getProject } from "../services/projectStore.js";
import { listSources } from "../services/sourceStore.js";
import { listUnits } from "../services/unitStore.js";

export function editorialRoutes(modelClientFactory: ModelClientFactory): Hono {
  const app = new Hono();

  app.put("/workspace", async (c) => {
    const projectId = c.req.param("projectId") as string;
    await getProject(projectId);
    const body = EditorialWorkspaceBodySchema.parse(await c.req.json());
    const workspace = await putWorkspace(projectId, body);
    return c.json({
      manuscript: workspace.manuscript,
      proposalCount: workspace.articulations.length,
    });
  });

  app.get("/sections/:sectionId/context", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const context = await loadSectionContext(projectId, c.req.param("sectionId") as string);
    return c.json(toPublicContext(context));
  });

  app.post("/sections/:sectionId/readings", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const sectionId = c.req.param("sectionId") as string;
    const body = ReadSectionBodySchema.parse(await c.req.json());
    const context = await loadSectionContext(projectId, sectionId);
    const workspace = context.workspace;
    const articulation = body.articulationId
      ? findArticulation(workspace.articulations, body.articulationId)
      : undefined;

    if (articulation && articulation.scope.sectionId !== sectionId) {
      throw new HTTPException(400, { message: "proposal does not belong to this section" });
    }

    const service = await makeDiffractionService(modelClientFactory);
    const reading = await service.diffract({
      statement: body.statement,
      claimIds: body.claimIds,
      sourceIds: body.sourceIds,
      bookParts: context.bookParts,
      bookPlan: context.bookPlan,
      existingCuts: context.existingCuts,
      bookBibliography: context.bookBibliography,
    });

    const stored = await storeReading(projectId, {
      scopeId: sectionId,
      articulationId: articulation?.id,
      reading,
    });

    if (articulation) {
      await saveArticulation(projectId, {
        ...articulation,
        diffractiveReading: reading,
        updatedAt: new Date().toISOString(),
      });
    }

    return c.json({ reading: stored, executable: false });
  });

  app.post("/proposals/:proposalId/accept", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const body = AcceptProposalBodySchema.parse(await c.req.json());
    const workspace = await getWorkspace(projectId);
    const proposal = findArticulation(workspace.articulations, c.req.param("proposalId") as string);
    const result = createEditorialDecisionService().accept(proposal, body);
    await acceptDecision(projectId, result.articulation, result.decision, result.event);
    return c.json({ decision: result.decision, event: result.event }, 201);
  });

  app.post("/proposals/:proposalId/modify", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const body = ModifyProposalBodySchema.parse(await c.req.json());
    const workspace = await getWorkspace(projectId);
    const proposal = findArticulation(workspace.articulations, c.req.param("proposalId") as string);
    const result = createEditorialDecisionService().modify(proposal, {}, body);
    await acceptDecision(projectId, result.articulation, result.decision, result.event);
    return c.json({ decision: result.decision, event: result.event }, 201);
  });

  app.post("/proposals/:proposalId/reject", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const body = RejectProposalBodySchema.parse(await c.req.json());
    const workspace = await getWorkspace(projectId);
    const proposal = findArticulation(workspace.articulations, c.req.param("proposalId") as string);
    const result = createEditorialDecisionService().reject(proposal, body.note);
    await updateArticulation(projectId, result.articulation, result.event);
    return c.json({ proposal: result.articulation, event: result.event });
  });

  return app;
}

type SectionContext = Awaited<ReturnType<typeof loadSectionContext>>;

async function loadSectionContext(projectId: string, sectionId: string) {
  await getProject(projectId);
  const workspace = await getWorkspace(projectId);
  const sectionPath = findNodePath(workspace.manuscript.tree, sectionId);
  const section = sectionPath.at(-1);
  if (!section || section.kind !== "node") {
    throw new HTTPException(404, { message: "manuscript section not found" });
  }

  const [sources, units] = await Promise.all([listSources(projectId), listUnits(projectId)]);
  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  const bookParts = projectBookState(workspace.manuscript, {
    resolveLeaf: (leaf) => {
      const unit = unitById.get(leaf.unitId);
      return {
        status: unit?.status ?? "drafting",
        text: unit?.content ?? "",
      };
    },
  });
  const bookPlan = projectBookPlan(workspace.manuscript);
  const relatedScopeIds = new Set(sectionPath.filter(isNode).map((node) => node.id));
  const relatedDecisions = workspace.decisions.filter(
    (decision) =>
      decision.status === "active" &&
      (decision.scope.level === "project" ||
        (decision.scope.sectionId && relatedScopeIds.has(decision.scope.sectionId)) ||
        (decision.scope.paragraphId && relatedScopeIds.has(decision.scope.paragraphId)))
  );
  const existingCuts = relatedDecisions.map((decision) => toExistingCut(decision, workspace.articulations));
  const projectedSources = projectBibliography(
    workspace.manuscript,
    workspace.distribution,
    sources,
    workspace.profiles
  ).find((projection) => projection.scopeId === sectionId)?.sources ?? [];

  return {
    projectId,
    workspace,
    section,
    bookParts,
    bookPlan,
    existingCuts,
    bookBibliography: {
      entries: projectedSources.map(({ sourceId, title, authors, subjects, concepts }) => ({
        sourceId,
        title,
        authors,
        subjects,
        concepts,
      })),
    },
    relatedDecisions,
    projectedSources,
  };
}

function toPublicContext(context: SectionContext) {
  return {
    projectId: context.projectId,
    section: { id: context.section.id, title: context.section.title },
    bookParts: context.bookParts.map(({ id, title, status }) => ({ id, title, status })),
    bookPlan: context.bookPlan,
    existingCuts: context.existingCuts,
    decisions: context.relatedDecisions.map((decision) => ({
      id: decision.id,
      status: decision.status,
      contentCommitments: decision.contentCommitments,
      formalCommitments: decision.formalCommitments,
      validation: decision.validation,
      supersedesDecisionId: decision.supersedesDecisionId,
    })),
    proposals: context.workspace.articulations
      .filter(
        (proposal) =>
          proposal.status === "candidate" && proposal.scope.sectionId === context.section.id
      )
      .map((proposal) => ({
        id: proposal.id,
        status: proposal.status,
        contentCommitments: proposal.intendedEffects.content,
        formalCommitments: proposal.intendedEffects.form,
      })),
    sources: context.projectedSources.map((source) => ({
      ...source,
      qualified: source.subjects.length > 0 || source.concepts.length > 0 || Boolean(source.abstract),
    })),
  };
}

function findArticulation(
  articulations: ContentStyleArticulation[],
  proposalId: string
): ContentStyleArticulation {
  const proposal = articulations.find((item) => item.id === proposalId);
  if (!proposal) {
    throw new HTTPException(404, { message: "editorial proposal not found" });
  }
  return proposal;
}

function toExistingCut(
  decision: EditorialDecision,
  articulations: ContentStyleArticulation[]
): { scope: string; verdict: string; cut: string } {
  const proposal = articulations.find((item) => item.id === decision.articulationId);
  return {
    scope: decision.scope.paragraphId ?? decision.scope.sectionId ?? "project",
    verdict: proposal?.diffractiveReading?.verdict ?? "validated",
    cut: decision.cut?.cut ?? decision.contentCommitments.join("; "),
  };
}

function findNodePath(children: ManuscriptChild[], targetId: string): ManuscriptChild[] {
  for (const child of children) {
    if (child.kind !== "node") continue;
    if (child.id === targetId) return [child];
    const nested = findNodePath(child.children, targetId);
    if (nested.length > 0) return [child, ...nested];
  }
  return [];
}

function isNode(child: ManuscriptChild): child is Extract<ManuscriptChild, { kind: "node" }> {
  return child.kind === "node";
}

async function makeDiffractionService(modelClientFactory: ModelClientFactory): Promise<DiffractionService> {
  const client = await modelClientFactory();
  return new DiffractionService(new StructuredClientAdapter(client));
}
