import { describe, it, expect } from "vitest";
import {
  createDiffractiveBatchRunner,
  createDiffractivePipeline,
  createContentStyleArticulation,
  type PlannedStylisticOperationInput,
} from "@auto-essay/core";

function readingOutput() {
  return {
    pass1: { refraction: ["r"] },
    pass2: { namedPatterns: [], revealedDefaults: [] },
    pass3: { entanglements: [] },
    pass4: { cut: "COUPE", included: [], excluded: [], cutOfNonAdoption: [] },
    verdict: "integrate_now",
    verdictDetail: "Intègre maintenant.",
    action: "a",
  };
}

const baseOps: PlannedStylisticOperationInput[] = [
  {
    family: "tone_lexicon",
    category: "conceptual_lexicon",
    operation: "reformulate temporality",
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

describe("diffractive core APIs", () => {
  it("diffracts a single fragment", async () => {
    const pipeline = createDiffractivePipeline({
      generateJson: async () => readingOutput(),
    });

    const reading = await pipeline.diffract({ statement: "s", claimIds: ["c1"] });

    expect(reading.verdict).toBe("integrate_now");
    expect(reading.fragment.claimIds).toEqual(["c1"]);
  });

  it("batches fragments and collects failures", async () => {
    const generateJson = async () => readingOutput();
    const batch = createDiffractiveBatchRunner({ generateJson });

    const result = await batch.run({
      fragments: [{ statement: "f1" }, { statement: "f2" }],
    });

    expect(result.readings).toHaveLength(2);
    expect(result.failures).toHaveLength(0);
  });

});
