import { describe, it, expect } from "vitest";
import {
  createContentStyleArticulation,
  type PlannedStylisticOperationInput,
} from "@auto-essay/core";
import { DiffractionService } from "../src/services/diffractionService.js";

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

describe("DiffractionService", () => {
  it("diffracts a single fragment", async () => {
    const service = new DiffractionService({
      generateJson: async () => readingOutput(),
    });

    const reading = await service.diffract({ statement: "s", claimIds: ["c1"] });

    expect(reading.verdict).toBe("integrate_now");
    expect(reading.fragment.claimIds).toEqual(["c1"]);
  });

  it("batches fragments and collects failures", async () => {
    const generateJson = async () => readingOutput();
    const service = new DiffractionService({ generateJson });

    const result = await service.diffractBatch({
      fragments: [{ statement: "f1" }, { statement: "f2" }],
    });

    expect(result.readings).toHaveLength(2);
    expect(result.failures).toHaveLength(0);
  });

});
