import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  IntegratedEvaluationHistoryEntrySchema,
  type IntegratedEvaluationHistoryEntry,
} from "@auto-essay/core";
import { getDataDir } from "../config.js";

const IntegratedEvaluationHistorySchema = z.object({
  history: z.array(IntegratedEvaluationHistoryEntrySchema),
});

export async function listIntegratedEvaluationHistory(
  projectId: string,
  unitId: string
): Promise<IntegratedEvaluationHistoryEntry[]> {
  const stored = await readHistory(projectId);
  return stored.history.filter((entry) => entry.unitId === unitId);
}

export async function appendIntegratedEvaluationHistory(
  projectId: string,
  entry: IntegratedEvaluationHistoryEntry
): Promise<IntegratedEvaluationHistoryEntry> {
  if (
    entry.context.writerProjection.scope.projectId !== projectId ||
    entry.context.evaluatorProjection.scope.projectId !== projectId ||
    entry.unitId !== entry.context.unitId ||
    entry.unitVersion !== entry.context.unitVersion ||
    entry.authorDecisions.some(
      (decision) => !entry.context.decisionIds.includes(decision.id)
    )
  ) {
    throw new Error("integrated evaluation history does not belong to its context");
  }

  const stored = await readHistory(projectId);
  const parsed = IntegratedEvaluationHistoryEntrySchema.parse(entry);
  stored.history.push(parsed);
  await writeHistory(projectId, stored);
  return parsed;
}

async function readHistory(
  projectId: string
): Promise<z.infer<typeof IntegratedEvaluationHistorySchema>> {
  try {
    const raw = await fs.readFile(historyPath(projectId), "utf-8");
    return IntegratedEvaluationHistorySchema.parse(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { history: [] };
    }
    throw error;
  }
}

async function writeHistory(
  projectId: string,
  history: z.infer<typeof IntegratedEvaluationHistorySchema>
): Promise<void> {
  const dir = projectDir(projectId);
  await fs.mkdir(dir, { recursive: true });
  const filePath = historyPath(projectId);
  const temporaryPath = `${filePath}.tmp`;
  await fs.writeFile(temporaryPath, JSON.stringify(history, null, 2));
  await fs.rename(temporaryPath, filePath);
}

function projectDir(projectId: string): string {
  return path.join(getDataDir(), projectId);
}

function historyPath(projectId: string): string {
  return path.join(projectDir(projectId), "integrated-evaluation-history.json");
}
