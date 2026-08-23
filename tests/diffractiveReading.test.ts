import { describe, expect, it } from "vitest";
import {
  DiffractiveReadingSchema,
  VerdictSchema,
  createDiffractiveReading,
} from "../src/domain/diffractiveReading";

describe("DiffractiveReading", () => {
  const fragment = {
    statement: "La temporalité messianique se reformule par la technique.",
    claimIds: ["claim-1"],
    sourceIds: ["source-1"],
  };

  it("creates a four-pass reading with a forced verdict", () => {
    const reading = createDiffractiveReading({
      fragment,
      pass1: {
        refraction: ["Le fragment devient une thèse sur la rédemption technique."],
      },
      pass2: {
        namedPatterns: ["Le livre contient déjà une tension mémoire/technique."],
        revealedDefaults: [
          { default: "Le ton académique", priorCut: "choix de voix au chapitre 1" },
        ],
      },
      pass3: {
        entanglements: [
          {
            name: "Benjamin / temporalité messianique",
            cutIfIntegrated: "Reformuler la thèse centrale",
            becomesIntelligible: ["La rédemption comme horizon technique"],
            becomesUnintelligible: ["La temporalité linéaire"],
          },
        ],
      },
      pass4: {
        cut: "Intégrer la reformulation technique du messianisme",
        included: ["Le chapitre sur la mémoire"],
        excluded: ["La lecture purement théologique"],
        cutOfNonAdoption: ["Perdre le pont avec l'afrofuturisme"],
      },
      verdict: "integrate_now",
      verdictDetail: "Intègre maintenant.",
      action: "Réécrire l'introduction autour de cette reformulation.",
    });

    expect(reading.id).toBeDefined();
    expect(reading.fragment.statement).toBe(fragment.statement);
    expect(reading.pass1.refraction).toHaveLength(1);
    expect(reading.pass2.namedPatterns).toHaveLength(1);
    expect(reading.pass2.revealedDefaults[0].priorCut).toBe(
      "choix de voix au chapitre 1"
    );
    expect(reading.pass3.entanglements).toHaveLength(1);
    expect(reading.pass4.excluded).toHaveLength(1);
    expect(reading.pass4.cutOfNonAdoption).toHaveLength(1);
    expect(reading.verdict).toBe("integrate_now");
  });

  it("accepts empty passes as explicit 'no non-obvious refraction'", () => {
    const reading = createDiffractiveReading({
      fragment,
      pass4: {
        cut: "Ne pas intégrer",
        included: [],
        excluded: [],
        cutOfNonAdoption: [],
      },
      verdict: "discard",
      verdictDetail: "Ne pas intégrer.",
      action: "Archiver le fragment.",
    });

    expect(reading.pass1.refraction).toEqual([]);
    expect(reading.pass2.namedPatterns).toEqual([]);
    expect(reading.pass3.entanglements).toEqual([]);
    expect(reading.verdict).toBe("discard");
  });

  it("accepts only the five forced verdicts — no hedging", () => {
    const valid = [
      "integrate_now",
      "adapt_differently",
      "incubate",
      "archive",
      "discard",
    ];
    for (const verdict of valid) {
      expect(VerdictSchema.safeParse(verdict).success).toBe(true);
    }
    expect(VerdictSchema.safeParse("it depends").success).toBe(false);
    expect(VerdictSchema.safeParse("maybe").success).toBe(false);
  });

  it("rejects a reading missing its forced verdict", () => {
    expect(() =>
      DiffractiveReadingSchema.parse({
        id: "reading-1",
        fragment,
        pass1: { refraction: [] },
        pass2: { namedPatterns: [], revealedDefaults: [] },
        pass3: { entanglements: [] },
        pass4: { cut: "x", included: [], excluded: [], cutOfNonAdoption: [] },
        action: "y",
        createdAt: new Date().toISOString(),
      })
    ).toThrow();
  });
});
