import { describe, expect, it } from "vitest";
import { createDiffractiveReading } from "../src/domain/diffractiveReading";

describe("DiffractiveReading tradeoffs (canonical matrix)", () => {
  it("carries the tradeoff matrix and a specific verdict", () => {
    const reading = createDiffractiveReading({
      fragment: { statement: "position" },
      pass4: { cut: "c", included: [], excluded: [], cutOfNonAdoption: [] },
      verdict: "adapt_differently",
      verdictDetail: "reformuler la coupe",
      action: "revoir l'intro",
      tradeoffs: [
        {
          path: "ne rien changer",
          effort: "nul",
          reversibility: "totale",
          leverage: "faible",
          distractionTax: "nulle",
          verdict: "discard",
        },
        {
          path: "intégrer autrement",
          effort: "modéré",
          reversibility: "haute",
          leverage: "fort",
          distractionTax: "moyenne",
          verdict: "adapt_differently",
        },
      ],
    });

    expect(reading.tradeoffs).toHaveLength(2);
    expect(reading.tradeoffs[0].path).toBe("ne rien changer");
    expect(reading.tradeoffs[1].verdict).toBe("adapt_differently");
  });

  it("defaults to an empty matrix when none is provided", () => {
    const reading = createDiffractiveReading({
      fragment: { statement: "position" },
      pass4: { cut: "c", included: [], excluded: [], cutOfNonAdoption: [] },
      verdict: "discard",
      verdictDetail: "hors propos",
      action: "archiver",
    });

    expect(reading.tradeoffs).toEqual([]);
  });
});
