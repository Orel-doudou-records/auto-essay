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

  it("embeds graph neighborhoods as candidate signals to qualify", () => {
    const prompt = buildDiffractivePrompt({
      statement: "Le vaisseau est un salon.",
      bookBibliography: {
        entries: [{ sourceId: "eshun2003", title: "Further Considerations on Afrofuturism" }],
        graphNeighborhoods: [
          {
            term: "star trek",
            text: "Voisinage du graphe (2 nœuds, 1 arête) :\n- Star Trek [concept] (trek.md)\n* Star Trek --influences [EXTRACTED 1]--> Spock",
          },
        ],
      },
    });

    expect(prompt).toContain("Signaux du graphe de la bibliothèque");
    expect(prompt).toContain("#### Terme du graphe : star trek");
    expect(prompt).toContain("Star Trek --influences [EXTRACTED 1]--> Spock");
    expect(prompt).toContain("Further Considerations on Afrofuturism");
    expect(prompt).toContain("le graphe suggère, la sémantique reste la tienne");
  });

  it("normalizes null on optional fields (LLM tolerance)", async () => {
    const generateJson = vi.fn(async () => ({
      ...fullOutput,
      pass2: {
        namedPatterns: [],
        revealedDefaults: [
          { default: "un défaut", priorCut: null },
        ],
      },
      planImpacts: [
        { partId: "chap-2", partTitle: "Le salon", entryId: null, impact: "Conclusion." },
      ],
    }));
    const reader = createDiffractiveReader({ generateJson });

    const reading = await reader.read({ statement: "Fragment." });

    expect(reading.pass2.revealedDefaults[0].priorCut).toBeUndefined();
    expect(reading.planImpacts[0].entryId).toBeUndefined();
    expect(reading.planImpacts[0].impact).toBe("Conclusion.");
  });
});
