import { Hono, type Context } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  createEditorialDecisionService,
  projectBibliography,
  projectBookPlan,
  projectBookState,
  projectChapterEditorialState,
  collectLeafReferences,
  type ChapterOperationEventType,
  type ContentStyleArticulation,
  type EditorialDecision,
  type ManuscriptChild,
} from "@auto-essay/core";
import type { ModelClientFactory } from "../llm/client.js";
import { StructuredClientAdapter } from "../llm/structuredAdapter.js";
import {
  AcceptProposalBodySchema,
  ChapterOperationDetailBodySchema,
  CreateChapterOperationBodySchema,
  CreateWritingDraftUnitBodySchema,
  EditorialWorkspaceBodySchema,
  ModifyProposalBodySchema,
  ReadSectionBodySchema,
  ReadScopedSectionBodySchema,
  RejectProposalBodySchema,
} from "../schemas/editorial.js";
import { DiffractionService } from "../services/diffractionService.js";
import {
  acceptDecision,
  getWorkspace,
  putWorkspace,
  saveArticulation,
  storeReading,
  type StoredReading,
  updateArticulation,
} from "../services/editorialWorkspaceStore.js";
import { getProject } from "../services/projectStore.js";
import { listSources } from "../services/sourceStore.js";
import { createUnit, listUnits, updateUnit } from "../services/unitStore.js";
import { prepareWritingContext } from "../services/writingContextService.js";
import { prepareIntegratedEvaluationContext } from "../services/integratedEvaluationPreparationService.js";
import { saveIntegratedEvaluationContext } from "../services/integratedEvaluationContextStore.js";
import {
  createStoredChapterOperation,
  getChapterOperation,
  transitionStoredChapterOperation,
} from "../services/chapterOperationStore.js";

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

  app.get("/chapters/:chapterId/workspace", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const chapterId = c.req.param("chapterId") as string;
    const workspace = await loadChapterWorkspace(projectId, chapterId);
    return c.json(toPublicChapterWorkspace(projectId, workspace));
  });

  app.post("/chapter-operations", async (c) => {
    const projectId = c.req.param("projectId") as string;
    await getProject(projectId);
    const body = CreateChapterOperationBodySchema.parse(await c.req.json());
    const operation = await createStoredChapterOperation(projectId, body.chapterId);
    return c.json({ operation, executed: false }, 201);
  });

  app.get("/chapter-operations/:operationId", async (c) => {
    const projectId = c.req.param("projectId") as string;
    await getProject(projectId);
    const operation = await getChapterOperation(projectId, c.req.param("operationId") as string);
    if (!operation) {
      throw new HTTPException(404, { message: "chapter operation not found" });
    }
    return c.json({ operation });
  });

  app.post("/chapter-operations/:operationId/await-author", async (c) =>
    transitionChapterOperationRoute(c, "await_author_approval", "system")
  );
  app.post("/chapter-operations/:operationId/start", async (c) =>
    transitionChapterOperationRoute(c, "start", "author")
  );
  app.post("/chapter-operations/:operationId/pause", async (c) =>
    transitionChapterOperationRoute(c, "pause", "system")
  );
  app.post("/chapter-operations/:operationId/resume", async (c) =>
    transitionChapterOperationRoute(c, "resume", "author")
  );
  app.post("/chapter-operations/:operationId/cancel", async (c) =>
    transitionChapterOperationRoute(c, "cancel", "author")
  );

  app.get("/sections/:sectionId/writing-context", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const sectionId = c.req.param("sectionId") as string;
    const decisionId = c.req.query("decisionId");
    if (!decisionId) {
      throw new HTTPException(400, { message: "decisionId is required" });
    }

    const { writingContext } = await loadWritingContext(projectId, sectionId, decisionId);
    return c.json(writingContext);
  });

  app.post("/sections/:sectionId/draft-units", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const sectionId = c.req.param("sectionId") as string;
    const body = CreateWritingDraftUnitBodySchema.parse(await c.req.json());
    const { decision, writingContext } = await loadWritingContext(
      projectId,
      sectionId,
      body.decisionId
    );
    const unit = await createUnit(projectId, {
      granularity: "paragraph",
      targetWordCount: body.targetWordCount,
      content: "",
      status: "drafting",
      thesis: decision.contentCommitments.join(" "),
      contextInPlan: { section: sectionId },
      evidencePack: writingContext.evidencePack,
      appliedDecisionIds: [decision.id],
      appliedArticulationIds: [decision.articulationId],
    });
    const workspace = await getWorkspace(projectId);
    const articulation = findArticulation(workspace.articulations, decision.articulationId);
    const evaluationContext = prepareIntegratedEvaluationContext({
      unit,
      decision,
      articulation,
    });
    const preparedUnit = await updateUnit(projectId, unit.id, {
      editorialPlanId: evaluationContext.editorialPlanId,
    });
    if (!preparedUnit) throw new Error("unit not found");
    await saveIntegratedEvaluationContext(projectId, evaluationContext);

    return c.json({ unit: preparedUnit, generated: false }, 201);
  });

  app.post("/sections/:sectionId/readings", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const sectionId = c.req.param("sectionId") as string;
    const body = ReadSectionBodySchema.parse(await c.req.json());
    const context = await loadSectionContext(projectId, sectionId);
    const stored = await createStoredAuthorReading({
      projectId,
      sectionId,
      context,
      modelClientFactory,
      statement: body.statement,
      claimIds: body.claimIds,
      sourceIds: body.sourceIds,
      articulationId: body.articulationId,
      scope: { kind: "fragment", sectionId },
    });
    return c.json(toPublicReading(stored));
  });

  app.post("/sections/:sectionId/readings/section", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const sectionId = c.req.param("sectionId") as string;
    const body = ReadScopedSectionBodySchema.parse(await c.req.json());
    const context = await loadSectionContext(projectId, sectionId);
    const statement = sectionStatement(context);
    const stored = await createStoredAuthorReading({
      projectId,
      sectionId,
      context,
      modelClientFactory,
      statement,
      articulationId: body.articulationId,
      scope: { kind: "section", sectionId },
    });
    return c.json(toPublicReading(stored));
  });

  app.post("/sections/:sectionId/paragraphs/:unitId/readings", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const sectionId = c.req.param("sectionId") as string;
    const unitId = c.req.param("unitId") as string;
    const body = ReadScopedSectionBodySchema.parse(await c.req.json());
    const context = await loadSectionContext(projectId, sectionId);
    const paragraph = context.paragraphs.find((unit) => unit.id === unitId);
    if (!paragraph) {
      throw new HTTPException(404, { message: "paragraph does not belong to this section" });
    }
    if (!paragraph.content.trim()) {
      throw new HTTPException(400, { message: "paragraph has no text to read" });
    }
    const stored = await createStoredAuthorReading({
      projectId,
      sectionId,
      context,
      modelClientFactory,
      statement: paragraph.content,
      claimIds: paragraph.claimIds,
      sourceIds: paragraph.evidencePack.sourceIds,
      articulationId: body.articulationId,
      scope: {
        kind: "paragraph",
        sectionId,
        unitId: paragraph.id,
        unitVersion: paragraph.version,
      },
    });
    return c.json(toPublicReading(stored));
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

type AuthorReadingScope = NonNullable<StoredReading["scope"]>;

async function createStoredAuthorReading(input: {
  projectId: string;
  sectionId: string;
  context: SectionContext;
  modelClientFactory: ModelClientFactory;
  statement: string;
  claimIds?: string[];
  sourceIds?: string[];
  articulationId?: string;
  scope: AuthorReadingScope;
}): Promise<StoredReading> {
  const articulation = input.articulationId
    ? findArticulation(input.context.workspace.articulations, input.articulationId)
    : undefined;
  if (articulation && articulation.scope.sectionId !== input.sectionId) {
    throw new HTTPException(400, { message: "proposal does not belong to this section" });
  }

  const service = await makeDiffractionService(input.modelClientFactory);
  const reading = await service.diffract({
    statement: input.statement,
    claimIds: input.claimIds,
    sourceIds: input.sourceIds,
    bookParts: input.context.bookParts,
    bookPlan: input.context.bookPlan,
    existingCuts: input.context.existingCuts,
    bookBibliography: input.context.bookBibliography,
  });
  const stored = await storeReading(input.projectId, {
    scopeId: input.sectionId,
    scope: input.scope,
    provenance: { triggeredBy: "author" },
    articulationId: articulation?.id,
    reading,
  });

  if (articulation) {
    await saveArticulation(input.projectId, {
      ...articulation,
      diffractiveReading: reading,
      updatedAt: new Date().toISOString(),
    });
  }
  return stored;
}

function sectionStatement(context: SectionContext): string {
  const text = [
    context.section.text,
    ...context.paragraphs.map((paragraph) => paragraph.content),
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join("\n\n");
  if (!text) {
    throw new HTTPException(400, { message: "section has no text to read" });
  }
  return text;
}

function toPublicReading(stored: StoredReading) {
  return {
    reading: stored.reading,
    executable: false as const,
    scope: stored.scope ?? { kind: "fragment" as const, sectionId: stored.scopeId },
    provenance: stored.provenance ?? { triggeredBy: "author" as const },
  };
}

async function transitionChapterOperationRoute(
  c: Context,
  type: Exclude<ChapterOperationEventType, "created">,
  actor: "author" | "system"
) {
  const projectId = c.req.param("projectId") as string;
  await getProject(projectId);
  const body = ChapterOperationDetailBodySchema.parse(await c.req.json());
  try {
    const operation = await transitionStoredChapterOperation(
      projectId,
      c.req.param("operationId") as string,
      {
        type,
        actor,
        occurredAt: new Date().toISOString(),
        detail: body.detail,
      }
    );
    if (!operation) {
      throw new HTTPException(404, { message: "chapter operation not found" });
    }
    return c.json({ operation, executed: false });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    if (error instanceof Error) {
      throw new HTTPException(400, { message: error.message });
    }
    throw error;
  }
}

async function loadChapterWorkspace(projectId: string, chapterId: string) {
  await getProject(projectId);
  const [workspace, sources, units] = await Promise.all([
    getWorkspace(projectId),
    listSources(projectId),
    listUnits(projectId),
  ]);

  try {
    return projectChapterEditorialState({
      chapterId,
      manuscript: workspace.manuscript,
      units,
      decisions: workspace.decisions,
      sources,
      profiles: workspace.profiles,
      distribution: workspace.distribution,
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("chapter not found:")) {
      throw new HTTPException(404, { message: "manuscript chapter not found" });
    }
    throw error;
  }
}

function toPublicChapterWorkspace(
  projectId: string,
  workspace: Awaited<ReturnType<typeof loadChapterWorkspace>>
) {
  return {
    chapter: workspace.chapter,
    sections: workspace.sections.map((section) => ({
      ...section,
      readiness: section.decisions.length > 0 ? "has_active_decision" : "needs_active_decision",
      transitions: {
        workshop: {
          sectionId: section.id,
          href: `/projects/${projectId}/atelier?sectionId=${section.id}`,
        },
        preparedUnits: section.units
          .filter((unit) => unit.preparedForWriting)
          .map((unit) => ({
            unitId: unit.id,
            href: `/projects/${projectId}/editor?unitId=${unit.id}`,
          })),
      },
    })),
  };
}

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
  const mountedUnitIds = new Set(
    collectLeafReferences(section.children).map((leaf) => leaf.unitId)
  );
  const paragraphs = units.filter(
    (unit) =>
      unit.granularity === "paragraph" &&
      (mountedUnitIds.has(unit.id) || unit.contextInPlan?.section === sectionId)
  );
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
    paragraphs,
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
    sources,
  };
}

async function loadWritingContext(projectId: string, sectionId: string, decisionId: string) {
  const context = await loadSectionContext(projectId, sectionId);
  const decision = findActiveWritingDecision(context.relatedDecisions, decisionId, sectionId);
  const writingContext = prepareWritingContext({
    sectionId,
    decision,
    sources: context.sources,
    profiles: context.workspace.profiles,
    distribution: context.workspace.distribution,
  });
  return { decision, writingContext };
}

function toPublicContext(context: SectionContext) {
  return {
    projectId: context.projectId,
    section: { id: context.section.id, title: context.section.title },
    diffraction: {
      mode: "strict" as const,
      paragraphs: context.paragraphs.map((paragraph) => ({
        id: paragraph.id,
        version: paragraph.version,
      })),
    },
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

function findActiveWritingDecision(
  decisions: EditorialDecision[],
  decisionId: string,
  sectionId: string
): EditorialDecision {
  const decision = decisions.find((item) => item.id === decisionId && item.status === "active");
  if (!decision) {
    throw new HTTPException(404, { message: "active editorial decision not found" });
  }
  if (decision.scope.level === "section" && decision.scope.sectionId !== sectionId) {
    throw new HTTPException(400, { message: "decision does not belong to this section" });
  }
  if (decision.scope.level === "paragraph") {
    throw new HTTPException(400, { message: "paragraph decisions require a paragraph writing context" });
  }
  return decision;
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
