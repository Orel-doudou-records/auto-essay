import type { StructuredModelClient } from "../evaluation/evaluateEssay";
import type {
  DiffractiveFragment,
  DiffractiveReading,
} from "../domain/diffractiveReading";
import {
  createDiffractiveReader,
  type BookPartInput,
  type DiffractiveReader,
  type ExistingCutInput,
} from "./diffractiveReader";

/**
 * Un fragment à diffracter au sein d'un lot : la position (statement) et ses
 * références optionnelles. Le livre, les concepts et les tensions sont partagés
 * au niveau du lot (ils ne changent pas d'un fragment à l'autre).
 */
export interface DiffractiveBatchFragment {
  statement: string;
  claimIds?: string[];
  sourceIds?: string[];
}

export interface DiffractiveBatchInput {
  fragments: DiffractiveBatchFragment[];
  book?: string;
  bookParts?: BookPartInput[];
  existingCuts?: ExistingCutInput[];
  concepts?: Array<{ label: string; definition: string }>;
  tensions?: Array<{ label: string; description: string }>;
}

export interface DiffractiveBatchFailure {
  fragment: DiffractiveFragment;
  error: string;
}

export interface DiffractiveBatchResult {
  readings: DiffractiveReading[];
  failures: DiffractiveBatchFailure[];
}

/**
 * Exécute une lecture diffractive sur plusieurs fragments d'un même livre.
 * Séquentiel (respecte les quotas), ordonné, et résilient : l'échec d'un
 * fragment est collecté sans interrompre les autres.
 */
export class DiffractiveBatchRunner {
  private readonly reader: DiffractiveReader;

  constructor(client: StructuredModelClient) {
    this.reader = createDiffractiveReader(client);
  }

  async run(batch: DiffractiveBatchInput): Promise<DiffractiveBatchResult> {
    const readings: DiffractiveReading[] = [];
    const failures: DiffractiveBatchFailure[] = [];

    for (const fragment of batch.fragments) {
      const recordedFragment: DiffractiveFragment = {
        statement: fragment.statement,
        claimIds: fragment.claimIds ?? [],
        sourceIds: fragment.sourceIds ?? [],
      };

      try {
        const reading = await this.reader.read({
          statement: fragment.statement,
          claimIds: fragment.claimIds,
          sourceIds: fragment.sourceIds,
          book: batch.book,
          bookParts: batch.bookParts,
          existingCuts: batch.existingCuts,
          concepts: batch.concepts,
          tensions: batch.tensions,
        });
        readings.push(reading);
      } catch (error) {
        failures.push({
          fragment: recordedFragment,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { readings, failures };
  }
}

export function createDiffractiveBatchRunner(
  client: StructuredModelClient
): DiffractiveBatchRunner {
  return new DiffractiveBatchRunner(client);
}
