import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { getDataDir } from "../config.js";
import { AutoEssayCanonicalFingerprintSchema } from "./collaborativeCoreStore.js";

const IdSchema = z.string().trim().min(1);

export const CollaborativeRevisionWorkDtoSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  unitId: IdSchema,
  literaryNodeId: IdSchema,
  workspaceId: IdSchema,
  baseRevisionId: IdSchema,
  headRevisionId: IdSchema,
  base: AutoEssayCanonicalFingerprintSchema.extend({
    content: z.string(),
  }),
  proposedContent: z.string(),
  status: z.enum(["working", "stale", "rejected", "integrated"]),
  proposalId: IdSchema.optional(),
  integrationId: IdSchema.optional(),
});

export type CollaborativeRevisionWorkDto = z.infer<
  typeof CollaborativeRevisionWorkDtoSchema
>;

const RevisionWorkFileSchema = z.object({
  works: z.record(CollaborativeRevisionWorkDtoSchema),
});

type RevisionWorkFile = z.infer<typeof RevisionWorkFileSchema>;

function filePath(projectId: string, dataDir = getDataDir()): string {
  return path.join(dataDir, projectId, "collaborative-core", "revision-works.json");
}

async function readFile(projectId: string): Promise<RevisionWorkFile> {
  try {
    const raw = await fs.readFile(filePath(projectId), "utf8");
    return RevisionWorkFileSchema.parse(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { works: {} };
    throw error;
  }
}

async function writeFile(projectId: string, value: RevisionWorkFile): Promise<void> {
  const target = filePath(projectId);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temp = `${target}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temp, JSON.stringify(RevisionWorkFileSchema.parse(value), null, 2), "utf8");
  await fs.rename(temp, target);
}

export async function saveCollaborativeRevisionWork(
  work: CollaborativeRevisionWorkDto
): Promise<void> {
  const value = CollaborativeRevisionWorkDtoSchema.parse(work);
  const state = await readFile(value.projectId);
  state.works[value.id] = value;
  await writeFile(value.projectId, state);
}

export async function loadCollaborativeRevisionWork(
  projectId: string,
  workId: string
): Promise<CollaborativeRevisionWorkDto | undefined> {
  const state = await readFile(projectId);
  const value = state.works[workId];
  return value === undefined ? undefined : structuredClone(value);
}

export async function listCollaborativeRevisionWorks(
  projectId: string
): Promise<CollaborativeRevisionWorkDto[]> {
  const state = await readFile(projectId);
  return Object.values(state.works)
    .map((work) => structuredClone(work))
    .sort((left, right) => left.id.localeCompare(right.id));
}
