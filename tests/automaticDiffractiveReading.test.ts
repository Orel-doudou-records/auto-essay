import { describe, expect, it } from "vitest";
import {
  completeAutomaticDiffractiveReading,
  createAutomaticDiffractiveReading,
  failAutomaticDiffractiveReading,
  startAutomaticDiffractiveReading,
} from "../src/domain/automaticDiffractiveReading";
import { createDiffractiveReading } from "../src/domain/diffractiveReading";

const readingInput = {
  fingerprint: "fingerprint-1",
  statement: "Texte de section à lire.",
  claimIds: [],
  sourceIds: [],
  bookParts: [],
  bookPlan: [],
  existingCuts: [],
  bookBibliography: { entries: [] },
};

const reading = createDiffractiveReading({
  fragment: { statement: readingInput.statement, claimIds: [], sourceIds: [] },
  pass4: { cut: "Conserver la tension", included: [], excluded: [], cutOfNonAdoption: [] },
  verdict: "incubate",
  verdictDetail: "Le texte demande une lecture située.",
  action: "Conserver la lecture pour revue auteur.",
});

describe("automatic diffractive reading", () => {
  it("moves a durable author request from pending to running then completed", () => {
    const pending = createAutomaticDiffractiveReading({
      projectId: "project-1",
      sectionId: "section-1",
      readingInput,
      trigger: "activation",
      createdAt: "2026-08-27T09:00:00.000Z",
    });
    expect(pending).toMatchObject({
      requestedBy: "author",
      status: "pending",
      input: readingInput,
    });

    const running = startAutomaticDiffractiveReading(pending, "2026-08-27T09:01:00.000Z");
    expect(running).toMatchObject({ status: "running", updatedAt: "2026-08-27T09:01:00.000Z" });

    const completed = completeAutomaticDiffractiveReading(
      running,
      reading,
      "2026-08-27T09:02:00.000Z"
    );
    expect(completed).toMatchObject({
      status: "completed",
      reading,
      updatedAt: "2026-08-27T09:02:00.000Z",
    });
  });

  it("records a worker failure without creating a reading or editorial instruction", () => {
    const pending = createAutomaticDiffractiveReading({
      projectId: "project-1",
      sectionId: "section-1",
      readingInput,
      trigger: "activation",
      createdAt: "2026-08-27T09:00:00.000Z",
    });

    const failed = failAutomaticDiffractiveReading(
      pending,
      "model temporarily unavailable",
      "2026-08-27T09:01:00.000Z"
    );
    expect(failed).toMatchObject({
      status: "failed",
      failure: "model temporarily unavailable",
    });
    expect(failed).not.toHaveProperty("reading");
    expect(failed).not.toHaveProperty("decisionId");
    expect(failed).not.toHaveProperty("articulationId");
  });
});
