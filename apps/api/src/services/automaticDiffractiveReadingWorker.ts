import {
  completeAutomaticDiffractiveReading,
  failAutomaticDiffractiveReading,
  startAutomaticDiffractiveReading,
  type AutomaticDiffractiveReading,
  type AutomaticDiffractiveReadingInput,
  type DiffractiveReading,
} from "@auto-essay/core";
import type { ModelClientFactory } from "../llm/client.js";
import { StructuredClientAdapter } from "../llm/structuredAdapter.js";
import { DiffractionService } from "./diffractionService.js";
import {
  listAutomaticDiffractiveReadings,
  updateAutomaticDiffractiveReading,
} from "./automaticDiffractiveReadingStore.js";

export type AutomaticDiffractiveReadingExecutor = (
  input: AutomaticDiffractiveReadingInput
) => Promise<DiffractiveReading>;

/**
 * Exécute une demande durable sans résoudre à nouveau son contexte. Le worker
 * ne sait ni créer une décision, ni modifier une unité, ni relier une lecture
 * à une proposition : il ne fait que compléter la demande qu’il a revendiquée.
 */
export class AutomaticDiffractiveReadingWorker {
  constructor(private readonly executeReading: AutomaticDiffractiveReadingExecutor) {}

  async resumePending(projectId: string): Promise<void> {
    const pending = await listAutomaticDiffractiveReadings(projectId);
    await Promise.all(
      pending
        .filter((reading) => reading.status === "pending" || reading.status === "running")
        .map((reading) => this.process(projectId, reading.id))
    );
  }

  async process(
    projectId: string,
    readingId: string
  ): Promise<AutomaticDiffractiveReading | undefined> {
    const claimed = await updateAutomaticDiffractiveReading(projectId, readingId, (reading) => {
      if (reading.status !== "pending" && reading.status !== "running") return reading;
      return startAutomaticDiffractiveReading(reading);
    });
    if (!claimed || claimed.status !== "running") return undefined;

    try {
      const reading = await this.executeReading(claimed.input);
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
}

export function createAutomaticDiffractiveReadingWorker(
  modelClientFactory: ModelClientFactory
): AutomaticDiffractiveReadingWorker {
  return new AutomaticDiffractiveReadingWorker(async (input) => {
    const client = await modelClientFactory();
    const service = new DiffractionService(new StructuredClientAdapter(client));
    return service.diffract(input);
  });
}
