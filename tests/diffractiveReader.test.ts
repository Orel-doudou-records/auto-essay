import { describe, expect, it, vi } from "vitest";
import {
  buildDiffractivePrompt,
  createDiffractiveReader,
} from "../src/editorial/diffractiveReader";

const fullOutput = {
  pass1: {
    refraction: ["Le fragment devient une thèse sur la rédemption technique."],
  },
  pass2: {
    namedPatterns: ["tension mémoire/technique"],
    revealedDefaults: [
      { default: "le ton académique", priorCut: "choix de voix §1" },
    ],
  },
  pass3: {
    entanglements: [
      {
        name: "Benjamin / temporalité messianique",
        cutIfIntegrated: "reformuler la thèse centrale",
        becomesIntelligible: ["la rédemption comme horizon technique"],
        becomesUnintelligible: ["la temporalité linéaire"],
      },
    ],
  },
  pass4: {
    cut: "Intégrer la reformulation technique",
    included: ["le chapitre mémoire"],
    excluded: ["la lecture théologique"],
    cutOfNonAdoption: ["perdre le pont afrofuturiste"],
  },
  verdict: "integrate_now",
  verdictDetail: "Intègre maintenant.",
  action: "Réécrire l'introduction.",
};

describe("DiffractiveReader", () => {
  it("produces a DiffractiveReading from a fragment and a book", async () => {
    const generateJson = vi.fn(async () => fullOutput);
    const reader = createDiffractiveReader({ generateJson });

    const reading = await reader.read({
      statement: "La temporalité messianique se reformule par la technique.",
      claimIds: ["claim-1"],
      sourceIds: ["source-1"],
      book: "Le livre en cours.",
    });

    expect(reading.fragment.statement).toBe(
      "La temporalité messianique se reformule par la technique."
    );
    expect(reading.fragment.claimIds).toEqual(["claim-1"]);
    expect(reading.fragment.sourceIds).toEqual(["source-1"]);
    expect(reading.verdict).toBe("integrate_now");
    expect(reading.pass4.excluded).toEqual(["la lecture théologique"]);
    expect(generateJson).toHaveBeenCalledOnce();
  });

  it("preserves empty passes as honest 'no non-obvious refraction'", async () => {
    const generateJson = vi.fn(async () => ({
      pass1: { refraction: [] },
      pass2: { namedPatterns: [], revealedDefaults: [] },
      pass3: { entanglements: [] },
      pass4: {
        cut: "ne pas intégrer",
        included: [],
        excluded: [],
        cutOfNonAdoption: [],
      },
      verdict: "discard",
      verdictDetail: "Ne pas intégrer.",
      action: "Archiver.",
    }));
    const reader = createDiffractiveReader({ generateJson });

    const reading = await reader.read({ statement: "Fragment." });

    expect(reading.pass1.refraction).toEqual([]);
    expect(reading.pass3.entanglements).toEqual([]);
    expect(reading.verdict).toBe("discard");
  });

  it("rejects a hedged verdict", async () => {
    const generateJson = vi.fn(async () => ({
      pass1: { refraction: [] },
      pass2: { namedPatterns: [], revealedDefaults: [] },
      pass3: { entanglements: [] },
      pass4: { cut: "x", included: [], excluded: [], cutOfNonAdoption: [] },
      verdict: "it depends",
      action: "x",
    }));
    const reader = createDiffractiveReader({ generateJson });

    await expect(reader.read({ statement: "Fragment." })).rejects.toThrow();
  });

  it("builds a prompt embedding the fragment and the book", () => {
    const prompt = buildDiffractivePrompt({
      statement: "Le messianisme se technicise.",
      book: "Extrait du manuscrit.",
    });

    expect(prompt).toContain("Le messianisme se technicise.");
    expect(prompt).toContain("Extrait du manuscrit.");
    expect(prompt).toContain("quatre passes");
  });
});
