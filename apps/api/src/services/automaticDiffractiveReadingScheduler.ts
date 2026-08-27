import { createHash } from "node:crypto";
import { HTTPException } from "hono/http-exception";
import {
  collectLeafReferences,
  projectBibliography,
  projectBookPlan,
  projectBookState,
  createAutomaticDiffractiveReading,
  supersedeAutomaticDiffractiveReading,
  type AutomaticDiffractiveReadingInput,
  type AutomaticDiffractiveReadingTrigger,
  type AutomaticDiffractiveReading,
  type ManuscriptChild,
} from "@auto-essay/core";
import type { ModelClientFactory } from "../llm/client.js";
import {
  getDiffractiveReadingMode,
  getWorkspace,
} from "./editorialWorkspaceStore.js";
import {
  listAutomaticDiffractiveReadings,
  storeAutomaticDiffractiveReading,
  updateAutomaticDiffractiveReading,
} from "./automaticDiffractiveReadingStore.js";
import { createAutomaticDiffractiveReadingWorker } from "./automaticDiffractiveReadingWorker.js";
import { listSources } from "./sourceStore.js";
import { listUnits } from "./unitStore.js";

/**
 * Coordonne les événements éditoriaux avec la file durable. L’interface de
 * cette classe ne connaît ni décision ni réécriture : elle ne peut déposer que
 * la lecture du dernier instantané distinct d’une section automatique.
 */
export async function enqueueAutomaticDiffractiveReading(input: {
  projectId: string;
  sectionId: string;
  trigger: AutomaticDiffractiveReadingTrigger;
  modelClientFactory: ModelClientFactory;
}): Promise<AutomaticDiffractiveReading | undefined> {
  const context = await loadAutomaticSectionContext(input.projectId, input.sectionId);
  if (getDiffractiveReadingMode(context.workspace, input.sectionId) !== "automatic") return undefined;

  let readingInput: AutomaticDiffractiveReadingInput;
  try {
    readingInput = toAutomaticReadingInput(context);
  } catch (error) {
    if (error instanceof HTTPException && error.status === 400) return undefined;
    throw error;
  }
  const current = await listAutomaticDiffractiveReadings(input.projectId, input.sectionId);
  if (current.some((reading) => reading.input.fingerprint === readingInput.fingerprint)) return undefined;

  await Promise.all(
    current
      .filter((reading) => reading.status === "pending")
      .map((reading) =>
        updateAutomaticDiffractiveReading(input.projectId, reading.id, (currentReading) =>
          supersedeAutomaticDiffractiveReading(currentReading)
        )
      )
  );

  const request = createAutomaticDiffractiveReading({
    projectId: input.projectId,
    sectionId: input.sectionId,
    trigger: input.trigger,
    readingInput,
  });
  await storeAutomaticDiffractiveReading(input.projectId, request);
  const worker = createAutomaticDiffractiveReadingWorker(input.modelClientFactory);
  setTimeout(() => {
    void worker.process(input.projectId, request.id).catch(() => undefined);
  }, 0);
  return request;
}

export async function enqueueAutomaticDiffractiveReadingsForProject(input: {
  projectId: string;
  trigger: Exclude<AutomaticDiffractiveReadingTrigger, "activation">;
  modelClientFactory: ModelClientFactory;
}): Promise<void> {
  const workspace = await getWorkspace(input.projectId).catch((error) => {
    if (error instanceof HTTPException && error.status === 404) return undefined;
    throw error;
  });
  if (!workspace) return;
  const sectionIds = workspace.diffractionSettings
    .filter((setting) => setting.mode === "automatic")
    .map((setting) => setting.sectionId);
  await Promise.all(
    sectionIds.map((sectionId) => enqueueAutomaticDiffractiveReading({ ...input, sectionId }))
  );
}

export async function getAutomaticDiffractiveReadingFingerprint(
  projectId: string,
  sectionId: string
): Promise<string> {
  const context = await loadAutomaticSectionContext(projectId, sectionId);
  return toAutomaticReadingInput(context).fingerprint;
}


type AutomaticSectionContext = Awaited<ReturnType<typeof loadAutomaticSectionContext>>;

async function loadAutomaticSectionContext(projectId: string, sectionId: string) {
  const workspace = await getWorkspace(projectId);
  const sectionPath = findNodePath(workspace.manuscript.tree, sectionId);
  const section = sectionPath.at(-1);
  if (!section || section.kind !== "node") {
    throw new HTTPException(404, { message: "manuscript section not found" });
  }

  const [sources, units] = await Promise.all([listSources(projectId), listUnits(projectId)]);
  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  const bookParts = projectBookState(workspace.manuscript, {
    resolveLeaf: (leaf) => ({
      status: unitById.get(leaf.unitId)?.status ?? "drafting",
      text: unitById.get(leaf.unitId)?.content ?? "",
    }),
  });
  const mountedUnitIds = new Set(collectLeafReferences(section.children).map((leaf) => leaf.unitId));
  const paragraphs = units.filter(
    (unit) =>
      unit.granularity === "paragraph" &&
      (mountedUnitIds.has(unit.id) || unit.contextInPlan?.section === sectionId)
  );
  const relatedScopeIds = new Set(sectionPath.filter(isNode).map((node) => node.id));
  const decisions = workspace.decisions.filter(
    (decision) =>
      decision.status === "active" &&
      (decision.scope.level === "project" ||
        (decision.scope.sectionId && relatedScopeIds.has(decision.scope.sectionId)) ||
        (decision.scope.paragraphId && relatedScopeIds.has(decision.scope.paragraphId)))
  );
  const existingCuts = decisions.map((decision) => ({
    scope: decision.scope.paragraphId ?? decision.scope.sectionId ?? "project",
    verdict:
      workspace.articulations.find((proposal) => proposal.id === decision.articulationId)
        ?.diffractiveReading?.verdict ?? "validated",
    cut: decision.cut?.cut ?? decision.contentCommitments.join("; "),
  }));
  const projectedSources = projectBibliography(
    workspace.manuscript,
    workspace.distribution,
    sources,
    workspace.profiles
  ).find((projection) => projection.scopeId === sectionId)?.sources ?? [];

  return {
    workspace,
    section,
    paragraphs,
    bookParts,
    bookPlan: projectBookPlan(workspace.manuscript),
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
  };
}

function toAutomaticReadingInput(context: AutomaticSectionContext): AutomaticDiffractiveReadingInput {
  const snapshot = {
    statement: [context.section.text, ...context.paragraphs.map((paragraph) => paragraph.content)]
      .map((text) => text?.trim())
      .filter((text): text is string => Boolean(text))
      .join("\n\n"),
    claimIds: [],
    sourceIds: [],
    bookParts: context.bookParts,
    bookPlan: context.bookPlan,
    existingCuts: context.existingCuts,
    bookBibliography: context.bookBibliography,
  };
  if (!snapshot.statement) {
    throw new HTTPException(400, { message: "section has no text to read" });
  }
  return {
    fingerprint: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"),
    ...snapshot,
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
