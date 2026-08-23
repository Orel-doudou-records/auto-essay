import { describe, expect, it, vi } from "vitest";
import {
  createContentStyleArticulation,
  type PlannedStylisticOperationInput,
} from "../src/domain/contentStyleArticulation";
import { createDiffractivePipeline } from "../src/editorial/diffractivePipeline";

function readingOutput() {
  return {
    pass1: { refraction: ["r"] },
    pass2: { namedPatterns: [], revealedDefaults: [] },
    pass3: { entanglements: [] },
    pass4: {
      cut: "LA COUPE",
      included: ["i"],
      excluded: ["e"],
      cutOfNonAdoption: [],
    },
    verdict: "integrate_now",
    action: "a",
  };
}

const baseOps: PlannedStylisticOperationInput[] = [
  {
    family: "tone_lexicon",
    category: "conceptual_lexicon",
    operation: "reformulate temporality through technique",
    target: "narrator_voice",
    rationale: "name the cut",
  },
];

function candidateArticulation() {
  return createContentStyleArticulation({
    scope: { level: "project", projectId: "project-1" },
    contentRelationIds: ["relation-1"],
    stylisticOperations: baseOps,
    intendedEffects: {
      content: ["reformulate temporality"],
      form: ["mark the narrator voice"],
    },
    origin: "system_proposed",
  });
}

const commitments = {
  contentCommitments: ["engagement"],
  formalCommitments: ["engagement formel"],
};

describe("DiffractivePipeline", () => {
  it("diffracts a fragment into a reading", async () => {
    const generateJson = vi.fn(async () => readingOutput());
    const pipeline = createDiffractivePipeline({ generateJson });

    const reading = await pipeline.diffract(
      { statement: "position", claimIds: ["c1"] },
      { book: "livre" }
    );

    expect(generateJson).toHaveBeenCalledTimes(1);
    expect(reading.fragment.statement).toBe("position");
    expect(reading.fragment.claimIds).toEqual(["c1"]);
    expect(reading.pass4.cut).toBe("LA COUPE");
  });

  it("attaches a reading to an articulation immutably", async () => {
    const generateJson = vi.fn(async () => readingOutput());
    const pipeline = createDiffractivePipeline({ generateJson });
    const articulation = candidateArticulation();
    const reading = await pipeline.diffract({ statement: "s" });

    const enriched = pipeline.attachReading(articulation, reading);

    expect(enriched.diffractiveReading).toEqual(reading);
    expect(enriched.id).toBe(articulation.id);
    expect(articulation.diffractiveReading).toBeUndefined();
  });

  it("accepts a candidate and derives the cut from the reading", async () => {
    const generateJson = vi.fn(async () => readingOutput());
    const pipeline = createDiffractivePipeline({ generateJson });
    const articulation = candidateArticulation();
    const reading = await pipeline.diffract({ statement: "s" });
    const enriched = pipeline.attachReading(articulation, reading);

    const result = pipeline.accept(enriched, commitments);

    expect(result.articulation.status).toBe("accepted");
    expect(result.articulation.diffractiveReading?.id).toBe(reading.id);
    expect(result.decision.cut?.cut).toBe("LA COUPE");
    expect(result.event.action).toBe("accepted");
  });

  it("runs the full fragment pipeline end-to-end", async () => {
    const generateJson = vi.fn(async () => readingOutput());
    const pipeline = createDiffractivePipeline({ generateJson });

    const result = await pipeline.runFragment(
      { statement: "position" },
      candidateArticulation(),
      commitments,
      { book: "livre" }
    );

    expect(generateJson).toHaveBeenCalledTimes(1);
    expect(result.reading.verdict).toBe("integrate_now");
    expect(result.articulation.status).toBe("accepted");
    expect(result.decision.cut?.cut).toBe("LA COUPE");
    expect(result.event.action).toBe("accepted");
  });
});
