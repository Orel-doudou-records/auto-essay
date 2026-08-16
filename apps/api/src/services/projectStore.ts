import fs from "node:fs/promises";
import path from "node:path";
import { getDataDir } from "../config.js";
import { HTTPException } from "hono/http-exception";
import { createEssayProject, EssayProjectSchema, type EssayProject } from "@auto-essay/core";

export async function listProjects(): Promise<Array<{ id: string; title: string; updatedAt: string }>> {
  const root = getDataDir();
  try {
    await fs.access(root);
  } catch {
    return [];
  }
  const entries = await fs.readdir(root, { withFileTypes: true });
  const projects: Array<{ id: string; title: string; updatedAt: string }> = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const project = await getProject(entry.name);
      projects.push({
        id: project.id,
        title: project.title,
        updatedAt: project.updatedAt,
      });
    } catch {
      // skip invalid directories
    }
  }
  return projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getProject(projectId: string): Promise<EssayProject> {
  try {
    const filePath = projectPath(projectId);
    const raw = await fs.readFile(filePath, "utf-8");
    return EssayProjectSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new HTTPException(404, { message: "project not found" });
    }
    throw err;
  }
}

export async function createNewProject(input: { title: string; thesisSeed?: string }): Promise<EssayProject> {
  const args: Parameters<typeof createEssayProject>[0] = { title: input.title };
  if (input.thesisSeed !== undefined) {
    args.thesisSeed = input.thesisSeed;
  }
  const project = createEssayProject(args);
  await writeProject(project.id, project);
  return project;
}

export async function updateProject(
  projectId: string,
  patch: Partial<Pick<EssayProject, "title" | "thesisSeed" | "voiceConfig" | "argumentMap">>
): Promise<EssayProject> {
  const project = await getProject(projectId);
  const updated: EssayProject = {
    ...project,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await writeProject(projectId, updated);
  return updated;
}

export async function deleteProject(projectId: string): Promise<void> {
  const dir = projectDir(projectId);
  await fs.rm(dir, { recursive: true, force: true });
}

function projectDir(projectId: string): string {
  return path.join(getDataDir(), projectId);
}

function projectPath(projectId: string): string {
  return path.join(projectDir(projectId), "project.json");
}

async function writeProject(projectId: string, project: EssayProject): Promise<void> {
  const dir = projectDir(projectId);
  await fs.mkdir(dir, { recursive: true });
  const filePath = projectPath(projectId);
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(project, null, 2));
  await fs.rename(tmpPath, filePath);
}
