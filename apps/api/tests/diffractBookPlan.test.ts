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

describe("DiffractionService — plan du livre", () => {
  it("passe bookPlan au lecteur diffractif", async () => {
    const prompts: string[] = [];
    const service = new DiffractionService({
      generateJson: async (prompt: string) => {
        prompts.push(prompt);
        return readingOutput();
      },
    });

    await service.diffract({
      statement: "s",
      bookPlan: [
        {
          partId: "chap-2",
          partTitle: "Chapitre 2",
          entries: [{ id: "e1", subject: "Le salon", preview: "La scène." }],
        },
      ],
    });

    expect(prompts[0]).toContain("## Le plan du livre");
    expect(prompts[0]).toContain("[e1] Le salon");
  });

  it("valide DiffractBodySchema avec bookPlan", () => {
    const parsed = DiffractBodySchema.parse({
      statement: "s",
      bookPlan: [
        {
          partId: "chap-2",
          partTitle: "Chapitre 2",
          entries: [
            { id: "e1", subject: "Le salon", notes: [{ kind: "human", text: "ok" }] },
          ],
        },
      ],
    });
    expect(parsed.bookPlan?.[0].partTitle).toBe("Chapitre 2");
    expect(parsed.bookPlan?.[0].entries[0].notes?.[0].kind).toBe("human");
  });

  it("rejette un kind de note inconnu", () => {
    expect(() =>
      DiffractBodySchema.parse({
        statement: "s",
        bookPlan: [
          {
            partId: "chap-2",
            partTitle: "Chapitre 2",
            entries: [
              { id: "e1", subject: "S", notes: [{ kind: "robot", text: "x" }] },
            ],
          },
        ],
      })
    ).toThrow();
  });
});