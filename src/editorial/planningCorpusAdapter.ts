import type { RetrievedPassage } from "../bibliography/corpusExplorer.js";
import {
  CorpusExplorationSnapshotSchema,
  type CorpusExplorationSnapshot,
} from "./planningSubjects.js";

/** Transitional Plan V2 bridge. RetrievedPassage remains the retrieval contract. */
export function createPlanningCorpusSnapshot(input: {
  registeredSourceCount: number;
  exploredSourceIds: string[];
  explorationComplete: boolean;
  passages: RetrievedPassage[];
}): CorpusExplorationSnapshot {
  return CorpusExplorationSnapshotSchema.parse({
    registeredSourceCount: input.registeredSourceCount,
    exploredSourceIds: [...new Set(input.exploredSourceIds)],
    explorationComplete: input.explorationComplete,
    passages: input.passages.map((passage) => ({
      id: passage.id,
      sourceId: passage.sourceId,
      text: passage.text,
      locator: `${passage.locator.kind}:${passage.locator.value}`,
    })),
  });
}
