import { describe, it, expect } from "vitest";
import { DiffractionService } from "../src/services/diffractionService.js";
import { DiffractBodySchema } from "../src/schemas/diffract.js";

function readingOutput() {
  return {
    pass1: { refraction: ["r"] },
    pass2: { namedPatterns: [], revealedDefaults: [] },
    pass3: { entanglements: [] },
    pass4: {
      cut: "COUPE",
      included: [],
      excluded: [],
      cutOfNonAdoption: [],
    },
    verdict: "integrate_now",
    verdictDetail: "Intègre maintenant.",
    action: "a",
    tradeoffs: [],
  };
}

describe("DiffractionService — état du livre", () => {
  it("passe bookParts et existingCuts au lecteur diffractif", async () => {
    const prompts: string[] = [];
    const service = new DiffractionService({
      generateJson: async (prompt: string) => {
        prompts.push(prompt);
        return readingOutput();
      },
    });

    await service.diffract({
      statement: "s",
      bookParts: [
        { id: "c1", title: "Chapitre 1", status: "drafting", text: "Ébauche." },
      ],
      existingCuts: [
        { scope: "chapitre 2", verdict: "integrate_now", cut: "coupe" },
      ],
    });

    expect(prompts[0]).toContain("## État du livre en cours");
    expect(prompts[0]).toContain("[ÉBAUCHE] Chapitre 1 (c1)");
    expect(prompts[0]).toContain("Coupes déjà édictées");
  });

  it("valide DiffractBodySchema avec bookParts et existingCuts", () => {
    const parsed = DiffractBodySchema.parse({
      statement: "s",
      bookParts: [{ id: "c1", title: "C1", status: "verified", text: "" }],
      existingCuts: [{ scope: "s", verdict: "integrate_now", cut: "c" }],
    });
    expect(parsed.bookParts?.[0].status).toBe("verified");
    expect(parsed.existingCuts?.[0].verdict).toBe("integrate_now");
  });

  it("rejette un statut inconnu dans bookParts", () => {
    expect(() =>
      DiffractBodySchema.parse({
        statement: "s",
        bookParts: [{ id: "c1", title: "C1", status: "nope", text: "" }],
      })
    ).toThrow();
  });
});