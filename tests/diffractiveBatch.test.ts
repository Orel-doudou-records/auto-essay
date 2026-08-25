import { describe, expect, it, vi } from "vitest";
import {
  createDiffractiveBatchRunner,
  type DiffractiveBatchInput,
} from "../src/editorial/diffractiveBatch";

function validOutput() {
  return {
    pass1: { refraction: ["r"] },
    pass2: { namedPatterns: [], revealedDefaults: [] },
    pass3: { entanglements: [] },
    pass4: { cut: "c", included: [], excluded: [], cutOfNonAdoption: [] },
    verdict: "integrate_now",
    verdictDetail: "Intègre maintenant.",
    action: "a",
  };
}

describe("DiffractiveBatchRunner", () => {
  it("diffracts every fragment in order", async () => {
    const generateJson = vi.fn(async () => validOutput());
    const runner = createDiffractiveBatchRunner({ generateJson });

    const batch: DiffractiveBatchInput = {
      fragments: [
        { statement: "f1", claimIds: ["c1"] },
        { statement: "f2", sourceIds: ["s1"] },
        { statement: "f3" },
      ],
      book: "livre",
      concepts: [{ label: "exil", definition: "d" }],
    };

    const result = await runner.run(batch);

    expect(generateJson).toHaveBeenCalledTimes(3);
    expect(result.readings).toHaveLength(3);
    expect(result.failures).toHaveLength(0);
    expect(result.readings.map((r) => r.fragment.statement)).toEqual([
      "f1",
      "f2",
      "f3",
    ]);
    expect(result.readings[0].fragment.claimIds).toEqual(["c1"]);
    expect(result.readings[1].fragment.sourceIds).toEqual(["s1"]);
  });

  it("collects a failure without stopping the rest of the batch", async () => {
    const generateJson = vi
      .fn()
      .mockResolvedValueOnce(validOutput())
      .mockRejectedValueOnce(new Error("quota dépassé"))
      .mockResolvedValueOnce(validOutput());
    const runner = createDiffractiveBatchRunner({ generateJson });

    const result = await runner.run({
      fragments: [
        { statement: "f1" },
        { statement: "f2" },
        { statement: "f3" },
      ],
    });

    expect(result.readings).toHaveLength(2);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].fragment.statement).toBe("f2");
    expect(result.failures[0].error).toBe("quota dépassé");
    expect(result.readings.map((r) => r.fragment.statement)).toEqual([
      "f1",
      "f3",
    ]);
  });

  it("returns an empty result for an empty batch", async () => {
    const generateJson = vi.fn(async () => validOutput());
    const runner = createDiffractiveBatchRunner({ generateJson });

    const result = await runner.run({ fragments: [] });

    expect(generateJson).not.toHaveBeenCalled();
    expect(result.readings).toEqual([]);
    expect(result.failures).toEqual([]);
  });

  it("forwards bookBibliography (graph neighborhoods) into the prompt", async () => {
    const generateJson = vi.fn(async () => validOutput());
    const runner = createDiffractiveBatchRunner({ generateJson });

    const result = await runner.run({
      fragments: [{ statement: "f1" }],
      bookBibliography: {
        entries: [{ sourceId: "eshun2003" }],
        graphNeighborhoods: [
          {
            term: "star trek",
            text: "Voisinage du graphe (2 nœuds, 1 arête) :\n- Star Trek [concept] (trek.md)",
          },
        ],
      },
    });

    expect(result.readings).toHaveLength(1);
    const prompt = generateJson.mock.calls[0][0] as string;
    expect(prompt).toContain("Signaux du graphe de la bibliothèque");
    expect(prompt).toContain("#### Terme du graphe : star trek");
  });
});
