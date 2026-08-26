import fs from "node:fs/promises";
import path from "node:path";
import {
  ChapterOperationSchema,
  createChapterOperation,
  transitionChapterOperation,
  type ChapterOperation,
  type ChapterOperationTransition,
} from "@auto-essay/core";
import { z } from "zod";
import { getDataDir } from "../config.js";

const ChapterOperationsFileSchema = z.object({
  operations: z.array(ChapterOperationSchema),
});

type ChapterOperationsFile = z.infer<typeof ChapterOperationsFileSchema>;

export async function listChapterOperations(projectId: string): Promise<ChapterOperation[]> {
  return (await readChapterOperations(projectId)).operations;
}

export async function getChapterOperation(
  projectId: string,
  operationId: string
): Promise<ChapterOperation | undefined> {
  return (await listChapterOperations(projectId)).find((operation) => operation.id === operationId);
}

export async function createStoredChapterOperation(
  projectId: string,
  chapterId: string
): Promise<ChapterOperation> {
  const data = await readChapterOperations(projectId);
  const operation = createChapterOperation({ projectId, chapterId, requestedBy: "author" });
  data.operations.push(operation);
  await writeChapterOperations(projectId, data);
  return operation;
}

export async function transitionStoredChapterOperation(
  projectId: string,
  operationId: string,
  transition: ChapterOperationTransition
): Promise<ChapterOperation | undefined> {
  const data = await readChapterOperations(projectId);
  const index = data.operations.findIndex((operation) => operation.id === operationId);
  if (index < 0) return undefined;

  data.operations[index] = transitionChapterOperation(data.operations[index], transition);
  await writeChapterOperations(projectId, data);
  return data.operations[index];
}

async function readChapterOperations(projectId: string): Promise<ChapterOperationsFile> {
  try {
    const raw = await fs.readFile(chapterOperationsPath(projectId), "utf-8");
    return ChapterOperationsFileSchema.parse(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { operations: [] };
    }
    throw error;
  }
}

async function writeChapterOperations(projectId: string, data: ChapterOperationsFile): Promise<void> {
  const directory = path.join(getDataDir(), projectId);
  await fs.mkdir(directory, { recursive: true });
  const target = chapterOperationsPath(projectId);
  const temporary = `${target}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(data, null, 2));
  await fs.rename(temporary, target);
}

function chapterOperationsPath(projectId: string): string {
  return path.join(getDataDir(), projectId, "chapter-operations.json");
}
