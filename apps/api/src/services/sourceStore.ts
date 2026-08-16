import fs from "node:fs/promises";
import path from "node:path";
import { getDataDir } from "../config.js";
import { SourceSchema, type Source } from "@auto-essay/core";
import { z } from "zod";

const SourcesFileSchema = z.object({
  sources: z.array(SourceSchema),
});

export async function listSources(projectId: string): Promise<Source[]> {
  const data = await readSourcesFile(projectId);
  return data.sources;
}

export async function getSource(projectId: string, sourceId: string): Promise<Source | undefined> {
  const sources = await listSources(projectId);
  return sources.find((s) => s.id === sourceId);
}

export async function setSources(projectId: string, sources: Source[]): Promise<void> {
  await writeSourcesFile(projectId, { sources });
}

export async function addSources(projectId: string, newSources: Source[]): Promise<Source[]> {
  const sources = await listSources(projectId);
  const merged = [...sources];
  for (const source of newSources) {
    const idx = merged.findIndex((s) => s.id === source.id);
    if (idx >= 0) {
      merged[idx] = source;
    } else {
      merged.push(source);
    }
  }
  await setSources(projectId, merged);
  return merged;
}

export async function updateSource(
  projectId: string,
  sourceId: string,
  patch: Partial<Omit<Source, "id">>
): Promise<Source | undefined> {
  const sources = await listSources(projectId);
  const idx = sources.findIndex((s) => s.id === sourceId);
  if (idx < 0) return undefined;
  const updated = { ...sources[idx], ...patch };
  sources[idx] = SourceSchema.parse(updated);
  await setSources(projectId, sources);
  return sources[idx];
}

export async function deleteSource(projectId: string, sourceId: string): Promise<boolean> {
  const sources = await listSources(projectId);
  const next = sources.filter((s) => s.id !== sourceId);
  if (next.length === sources.length) return false;
  await setSources(projectId, next);
  return true;
}

async function readSourcesFile(projectId: string): Promise<z.infer<typeof SourcesFileSchema>> {
  const filePath = sourcesPath(projectId);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return SourcesFileSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { sources: [] };
    }
    throw err;
  }
}

async function writeSourcesFile(projectId: string, data: z.infer<typeof SourcesFileSchema>): Promise<void> {
  const dir = path.join(getDataDir(), projectId);
  await fs.mkdir(dir, { recursive: true });
  const filePath = sourcesPath(projectId);
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2));
  await fs.rename(tmpPath, filePath);
}

function sourcesPath(projectId: string): string {
  return path.join(getDataDir(), projectId, "sources.json");
}
