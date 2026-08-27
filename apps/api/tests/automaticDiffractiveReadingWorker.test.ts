import { describe, expect, it, vi } from "vitest";
import {
  createAutomaticDiffractiveReading,
  supersedeAutomaticDiffractiveReading,
} from "@auto-essay/core";
import { AutomaticDiffractiveReadingWorker } from "../src/services/automaticDiffractiveReadingWorker.js";
import {
  listAutomaticDiffractiveReadings,
  storeAutomaticDiffractiveReading,
  updateAutomaticDiffractiveReading,
} from "../src/services/automaticDiffractiveReadingStore.js";
import { makeTempDataDir } from "./helper";

const input = {
  fingerprint: "fingerprint-superseded",
  statement: "Texte de section à lire.",
  claimIds: [],
  sourceIds: [],
  bookParts: [],
  bookPlan: [],
  existingCuts: [],
  bookBibliography: { entries: [] },
};

describe("automatic diffractive reading worker", () => {
  it("ignores a superseded request without invoking the reading executor", async () => {
    process.env.AUTO_ESSAY_DATA_DIR = makeTempDataDir();
    const request = createAutomaticDiffractiveReading({
      projectId: "project-1",
      sectionId: "section-1",
      trigger: "text_changed",
      readingInput: input,
    });
    await storeAutomaticDiffractiveReading("project-1", request);
    await updateAutomaticDiffractiveReading("project-1", request.id, (current) =>
      supersedeAutomaticDiffractiveReading(current)
    );
    const executeReading = vi.fn();
    const worker = new AutomaticDiffractiveReadingWorker(executeReading);

    await expect(worker.process("project-1", request.id)).resolves.toBeUndefined();

    expect(executeReading).not.toHaveBeenCalled();
    await expect(listAutomaticDiffractiveReadings("project-1", "section-1")).resolves.toMatchObject([
      { id: request.id, status: "superseded" },
    ]);
  });
});
