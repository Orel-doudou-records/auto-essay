import { describe, expect, it } from "vitest";
import {
  applyPlanPreviews,
  buildPlanPreviewPrompt,
  diffractPlan,
  elaboratePlanPreview,
  type PlanPreviewEntry,
} from "../src/editorial/planPreview";
import type { BookPlanInput } from "../src/editorial/diffractiveReader";

const bookPlan: BookPlanInput[] = [
  {
    partId: "chap-2",
    partTitle: "Chapitre 2",
    entries: [
      { id: "e1", subject: "Le salon", notes: [{ kind: "human", text: "garder le contraste" }] },
      { id: "e2", subject: "Abikou et le rêve prémonitoire" },
    ],
  },
  {
    partId: "chap-3",
    partTitle: "Chapitre 3",
    entries: [{ id: "e3", subject: "Sun Ra et les pyramides" }],
  },
];

describe("buildPlanPreviewPrompt", () => {
  it("contient les sujets, les notes et la consigne", () => {
    const prompt = buildPlanPreviewPrompt(bookPlan);
    expect(prompt).toContain("Le salon");
    expect(prompt).toContain("garder le contraste");
    expect(prompt).toContain("Sun Ra et les pyramides");
    expect(prompt).toContain("Format JSON strict");
  });
});

describe("elaboratePlanPreview", () => {
  it("élabore et ne garde que les ids existants dans le plan", async () => {
    const fake = {
      generateJson: async (): Promise<unknown> => [
        { entryId: "e1", preview: "La scène domestique." },
        { entryId: "e2", preview: "Le rêve prémonitoire d'Abikou." },
        { entryId: "e-inconnue", preview: "spéculation ignorée" },
      ],
    };

    const previews = await elaboratePlanPreview(bookPlan, fake);

    expect(previews).toEqual([
      { entryId: "e1", preview: "La scène domestique." },
      { entryId: "e2", preview: "Le rêve prémonitoire d'Abikou." },
    ]);
  });

  it("rejette une sortie non structurée", async () => {
    const fake = { generateJson: async (): Promise<unknown> => ({ nope: 1 }) };
    await expect(elaboratePlanPreview(bookPlan, fake)).rejects.toThrow();
  });

  it("refuse un plan invalide", async () => {
    await expect(
      elaboratePlanPreview([], { generateJson: async () => [] })
    ).rejects.toThrow();
  });
});

describe("applyPlanPreviews", () => {
  it("fusionne les previews par entryId, ignore les inconnus", () => {
    const previews: PlanPreviewEntry[] = [
      { entryId: "e1", preview: "La scène domestique." },
      { entryId: "absent", preview: "ignoré" },
    ];

    const enriched = applyPlanPreviews(bookPlan, previews);

    expect(enriched[0].entries[0].preview).toBe("La scène domestique.");
    expect(enriched[0].entries[1].preview).toBeUndefined();
    expect(enriched[0].entries[0].id).toBe("e1");
    expect(enriched[1].entries[0].preview).toBeUndefined();
  });
});

describe("diffractPlan", () => {
  it("diffracte le plan via le moteur (statement + section plan)", async () => {
    let capturedPrompt = "";
    const fake = {
      generateJson: async (prompt: string): Promise<unknown> => {
        capturedPrompt = prompt;
        return {
          pass1: { refraction: ["r"] },
          pass2: { namedPatterns: [], revealedDefaults: [] },
          pass3: { entanglements: [] },
          pass4: { cut: "c", included: [], excluded: [], cutOfNonAdoption: [] },
          verdict: "adapt_differently",
          verdictDetail: "réordonner la transition",
          action: "déplacer e2 après e4",
          tradeoffs: [],
        };
      },
    };

    const reading = await diffractPlan({ plan: bookPlan }, fake);

    expect(reading.verdict).toBe("adapt_differently");
    expect(reading.action).toBe("déplacer e2 après e4");
    expect(capturedPrompt).toContain("## Le plan du livre");
    expect(capturedPrompt).toContain("Le salon");
    expect(reading.planImpacts).toEqual([]);
  });
});