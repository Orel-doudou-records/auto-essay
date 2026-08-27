import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  IntegratedEvaluationContextSchema,
  type IntegratedEvaluationContext,
} from "@auto-essay/core";
import { getDataDir } from "../config.js";

const IntegratedEvaluationContextsSchema = z.object({
  contexts: z.array(IntegratedEvaluationContextSchema),
});

export async function getIntegratedEvaluationContext(
  projectId: string,
  unitId: string
): Promise<IntegratedEvaluationContext | undefined> {
  const stored = await readContexts(projectId);
  return stored.contexts.find((context) => context.unitId === unitId);
}

export async function saveIntegratedEvaluationContext(
  projectId: string,
  context: IntegratedEvaluationContext
): Promise<void> {
  if (
    context.writerProjection.scope.projectId !== projectId ||
    context.evaluatorProjection.scope.projectId !== projectId
  ) {
    throw new Error("integrated evaluation context does not belong to project");
  }

  const stored = await readContexts(projectId);
  const index = stored.contexts.findIndex((item) => item.unitId === context.unitId);
  if (index >= 0) {
    stored.contexts[index] = IntegratedEvaluationContextSchema.parse(context);
  } else {
    stored.contexts.push(IntegratedEvaluationContextSchema.parse(context));
  }
  await writeContexts(projectId, stored);
}

export async function updateIntegratedEvaluationContext(
  projectId: string,
  unitId: string,
  update: (context: IntegratedEvaluationContext) => IntegratedEvaluationContext
): Promise<IntegratedEvaluationContext | undefined> {
  const stored = await readContexts(projectId);
  const index = stored.contexts.findIndex((context) => context.unitId === unitId);
  if (index < 0) return undefined;

  stored.contexts[index] = IntegratedEvaluationContextSchema.parse(update(stored.contexts[index]));
  await writeContexts(projectId, stored);
  return stored.contexts[index];
}

async function readContexts(
  projectId: string
): Promise<z.infer<typeof IntegratedEvaluationContextsSchema>> {
  try {
    const raw = await fs.readFile(contextsPath(projectId), "utf-8");
    return IntegratedEvaluationContextsSchema.parse(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { contexts: [] };
    }
    throw error;
  }
}

async function writeContexts(
  projectId: string,
  contexts: z.infer<typeof IntegratedEvaluationContextsSchema>
): Promise<void> {
  const dir = projectDir(projectId);
  await fs.mkdir(dir, { recursive: true });
  const filePath = contextsPath(projectId);
  const temporaryPath = `${filePath}.tmp`;
  await fs.writeFile(temporaryPath, JSON.stringify(contexts, null, 2));
  await fs.rename(temporaryPath, filePath);
}

function projectDir(projectId: string): string {
  return path.join(getDataDir(), projectId);
}

function contextsPath(projectId: string): string {
  return path.join(projectDir(projectId), "integrated-evaluation-contexts.json");
}
