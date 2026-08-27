import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  assertDistributionValid,
  BibliographyDistributionEntrySchema,
  ContentStyleArticulationSchema,
  DiffractiveReadingSchema,
  EditorialDecisionSchema,
  EditorialGovernanceEventSchema,
  ManuscriptSchema,
  SourceProfileSchema,
  type ContentStyleArticulation,
  type EditorialDecision,
  type EditorialGovernanceEvent,
} from "@auto-essay/core";
import { HTTPException } from "hono/http-exception";
import { getDataDir } from "../config.js";

const ReadingScopeSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("fragment"),
    sectionId: z.string().min(1),
  }),
  z.object({
    kind: z.literal("section"),
    sectionId: z.string().min(1),
  }),
  z.object({
    kind: z.literal("paragraph"),
    sectionId: z.string().min(1),
    unitId: z.string().min(1),
    unitVersion: z.number().int().min(1),
  }),
]);

const ReadingProvenanceSchema = z.object({
  triggeredBy: z.literal("author"),
});

const StoredReadingSchema = z.object({
  id: z.string().min(1),
  scopeId: z.string().min(1),
  scope: ReadingScopeSchema.optional(),
  provenance: ReadingProvenanceSchema.optional(),
  articulationId: z.string().min(1).optional(),
  reading: DiffractiveReadingSchema,
  createdAt: z.string().datetime(),
});

export type StoredReading = z.infer<typeof StoredReadingSchema>;

export const EditorialWorkspaceSchema = z.object({
  manuscript: ManuscriptSchema,
  distribution: z.array(BibliographyDistributionEntrySchema).default([]),
  profiles: z.array(SourceProfileSchema).default([]),
  articulations: z.array(ContentStyleArticulationSchema).default([]),
  decisions: z.array(EditorialDecisionSchema).default([]),
  readings: z.array(StoredReadingSchema).default([]),
  events: z.array(EditorialGovernanceEventSchema).default([]),
});

export type EditorialWorkspace = z.infer<typeof EditorialWorkspaceSchema>;

export async function putWorkspace(
  projectId: string,
  input: Pick<EditorialWorkspace, "manuscript" | "distribution" | "profiles" | "articulations">
): Promise<EditorialWorkspace> {
  if (input.manuscript.projectId !== projectId) {
    throw new HTTPException(400, { message: "manuscript project does not match route project" });
  }
  assertDistributionValid(input.distribution, input.manuscript);

  const current = await readWorkspace(projectId);
  const workspace = EditorialWorkspaceSchema.parse({
    ...input,
    decisions: current?.decisions ?? [],
    readings: current?.readings ?? [],
    events: current?.events ?? [],
  });
  await writeWorkspace(projectId, workspace);
  return workspace;
}

export async function getWorkspace(projectId: string): Promise<EditorialWorkspace> {
  const workspace = await readWorkspace(projectId);
  if (!workspace) {
    throw new HTTPException(404, { message: "editorial workspace not found" });
  }
  return workspace;
}

export async function storeReading(
  projectId: string,
  input: Omit<StoredReading, "id" | "createdAt">
): Promise<StoredReading> {
  return mutateWorkspace(projectId, (workspace) => {
    const reading = StoredReadingSchema.parse({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...input,
    });
    workspace.readings.push(reading);
    return reading;
  });
}

export async function saveArticulation(
  projectId: string,
  articulation: ContentStyleArticulation
): Promise<void> {
  await mutateWorkspace(projectId, (workspace) => {
    const index = workspace.articulations.findIndex((item) => item.id === articulation.id);
    if (index < 0) {
      throw new HTTPException(404, { message: "editorial proposal not found" });
    }
    workspace.articulations[index] = ContentStyleArticulationSchema.parse(articulation);
  });
}

export async function updateArticulation(
  projectId: string,
  articulation: ContentStyleArticulation,
  event: EditorialGovernanceEvent
): Promise<void> {
  await mutateWorkspace(projectId, (workspace) => {
    const index = workspace.articulations.findIndex((item) => item.id === articulation.id);
    if (index < 0) {
      throw new HTTPException(404, { message: "editorial proposal not found" });
    }
    workspace.articulations[index] = ContentStyleArticulationSchema.parse(articulation);
    workspace.events.push(EditorialGovernanceEventSchema.parse(event));
  });
}

export async function acceptDecision(
  projectId: string,
  articulation: ContentStyleArticulation,
  decision: EditorialDecision,
  event: EditorialGovernanceEvent
): Promise<void> {
  await mutateWorkspace(projectId, (workspace) => {
    const index = workspace.articulations.findIndex((item) => item.id === articulation.id);
    if (index < 0) {
      throw new HTTPException(404, { message: "editorial proposal not found" });
    }
    workspace.articulations[index] = ContentStyleArticulationSchema.parse(articulation);
    workspace.decisions.push(EditorialDecisionSchema.parse(decision));
    workspace.events.push(EditorialGovernanceEventSchema.parse(event));
  });
}

export async function mutateWorkspace<T>(
  projectId: string,
  mutator: (workspace: EditorialWorkspace) => T
): Promise<T> {
  const workspace = await getWorkspace(projectId);
  const result = mutator(workspace);
  await writeWorkspace(projectId, EditorialWorkspaceSchema.parse(workspace));
  return result;
}

async function readWorkspace(projectId: string): Promise<EditorialWorkspace | null> {
  try {
    const raw = await fs.readFile(workspacePath(projectId), "utf-8");
    return EditorialWorkspaceSchema.parse(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function writeWorkspace(projectId: string, workspace: EditorialWorkspace): Promise<void> {
  const dir = projectDir(projectId);
  await fs.mkdir(dir, { recursive: true });
  const filePath = workspacePath(projectId);
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(workspace, null, 2));
  await fs.rename(tmpPath, filePath);
}

function projectDir(projectId: string): string {
  return path.join(getDataDir(), projectId);
}

function workspacePath(projectId: string): string {
  return path.join(projectDir(projectId), "editorial-workspace.json");
}
