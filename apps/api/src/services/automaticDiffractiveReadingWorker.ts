import {
  completeAutomaticDiffractiveReading,
  createDiffractivePipeline,
  failAutomaticDiffractiveReading,
  startAutomaticDiffractiveReading,
  type AutomaticDiffractiveReading,
  type AutomaticDiffractiveReadingInput,
  type DiffractiveReading,
} from "@auto-essay/core";
import type { ModelClientFactory } from "../llm/client.js";
import { StructuredClientAdapter } from "../llm/structuredAdapter.js";
import {
  listAutomaticDiffractiveReadings,
  updateAutomaticDiffractiveReading,
} from "./automaticDiffractiveReadingStore.js";

/**
 * Exécute une demande durable sans résoudre à nouveau son contexte. Le worker
 * ne sait ni créer une décision, ni modifier une unité, ni relier une lecture
 * à une proposition : il ne fait que compléter la demande qu’il a revendiquée.
 */
export async function resumeAutomaticDiffractiveReadings(
  projectId: string,
  modelClientFactory: ModelClientFactory
): Promise<void> {
  const pending = await listAutomaticDiffractiveReadings(projectId);
  await Promise.all(
    pending
      .filter((reading) => reading.status === "pending" || reading.status === "running")
      .map((reading) => processAutomaticDiffractiveReading(projectId, reading.id, modelClientFactory))
  );
}

export async function processAutomaticDiffractiveReading(
  projectId: string,
  readingId: string,
  modelClientFactory: ModelClientFactory
): Promise<AutomaticDiffractiveReading | undefined> {
  const claimed = await updateAutomaticDiffractiveReading(projectId, readingId, (reading) => {
    if (reading.status !== "pending" && reading.status !== "running") return reading;
    return startAutomaticDiffractiveReading(reading);
  });
  if (!claimed || claimed.status !== "running") return undefined;

  try {
    const reading = await executeAutomaticDiffractiveReading(claimed.input, modelClientFactory);
    return await updateAutomaticDiffractiveReading(projectId, readingId, (current) => {
      if (current.status !== "running") return current;
      return completeAutomaticDiffractiveReading(current, reading);
    });
  } catch (error) {
    const failure = error instanceof Error ? error.message : String(error);
    return await updateAutomaticDiffractiveReading(projectId, readingId, (current) => {
      if (current.status !== "pending" && current.status !== "running") return current;
      return failAutomaticDiffractiveReading(current, failure);
    });
  }
}

async function executeAutomaticDiffractiveReading(
  input: AutomaticDiffractiveReadingInput,
  modelClientFactory: ModelClientFactory
): Promise<DiffractiveReading> {
  const client = await modelClientFactory();
  const pipeline = createDiffractivePipeline(new StructuredClientAdapter(client));
  return pipeline.diffractRequest(input);
}
