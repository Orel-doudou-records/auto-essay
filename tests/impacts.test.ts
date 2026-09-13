import { describe, expect, it } from "vitest";
import type { BibliographyImpact } from "../src/domain/diffractiveReading";
import {
  assertBibliographyValid,
  buildBibliographySection,
  createDiffractiveReader,
  formatBibliographyEntry,
  type BookBibliographyInput,
} from "../src/editorial/diffractiveReader";
import { applyBibliographyImpacts } from "../src/bibliography/impacts";

const bibliography: BookBibliographyInput = {
  entries: [
    {
      sourceId: "src-1",
      title: "More Wandering Stars",
      authors: ["Jack Dann"],
      subjects: ["anthologie"],
      concepts: ["golem"],
    },
    { sourceId: "src-2", title: "Sans titre" },
  ],
};

describe("assertBibliographyValid + formatage", () => {
  it("refuse les sourceId dupliqués", () => {
    expect(() =>
      assertBibliographyValid({
        entries: [
          { sourceId: "a" },
          { sourceId: "a" },
        ],
      })
    ).toThrow("duplicated");
  });

  it("accepte une bibliothèque simple", () => {
    expect(() => assertBibliographyValid(bibliography)).not.toThrow();
  });

  it("formate une entrée compacte avec sujets et concepts", () => {
    const line = formatBibliographyEntry(bibliography.entries[0]);
    expect(line).toContain("src-1 | More Wandering Stars");
    expect(line).toContain("sujets : anthologie");
    expect(line).toContain("concepts : golem");
  });

  it("construit la section documentaire sans déclencher de retrieval dans Diffract", () => {
    const section = buildBibliographySection(bibliography);
    expect(section).toContain("## Matière documentaire du scope");
    expect(section).toContain("Diffract n'effectue aucun retrieval");
    expect(section).toContain("ne les transforme pas en preuve par simple similarité");
    expect(section).toContain("src-2 | Sans titre");
  });
});

describe("lecture diffractive avec bibliothèque (F3)", () => {
  it("propage bibliographyImpacts dans la lecture", async () => {
    const raw = {
      pass1: { refraction: ["r"] },
      pass2: { namedPatterns: [], revealedDefaults: [] },
      pass3: { entanglements: [] },
      pass4: { cut: "c", included: [], excluded: [], cutOfNonAdoption: [] },
      verdict: "adapt_differently",
      verdictDetail: "revoir la place de la source",
      action: "a",
      tradeoffs: [],
      planImpacts: [],
      bibliographyImpacts: [
        {
          sourceId: "src-1",
          scopeId: "chap-3",
          kind: "redistribuer",
          impact: "Cette source documente mieux le chapitre 3.",
        },
      ],
    };
    const fake = {
      generateJson: async (): Promise<unknown> => raw,
    };
    const reader = createDiffractiveReader(fake);
    const reading = await reader.read({
      statement: "Le golem comme machine",
      bookBibliography: bibliography,
    });
    expect(reading.bibliographyImpacts).toHaveLength(1);
    expect(reading.bibliographyImpacts[0].kind).toBe("redistribuer");
    expect(reading.bibliographyImpacts[0].scopeId).toBe("chap-3");
  });
});

describe("applyBibliographyImpacts", () => {
  const impacts: BibliographyImpact[] = [
    {
      sourceId: "s1",
      scopeId: "chap-2",
      kind: "redistribuer",
      impact: "Déplacer",
    },
  ];

  it("applique la redistribution en remplaçant le scope de la source", () => {
    const result = applyBibliographyImpacts(
      [{ sourceId: "s1", scopeId: "chap-1", rationale: "ancien", confidence: 1 }],
      impacts
    );
    expect(result).toEqual([
      { sourceId: "s1", scopeId: "chap-2", rationale: "Déplacer", confidence: 1 },
    ]);
  });

  it("n'applique pas rapproche/manquante à la distribution", () => {
    const original = [{ sourceId: "s1", scopeId: "chap-1", rationale: "ancien", confidence: 1 }];
    expect(
      applyBibliographyImpacts(original, [
        { sourceId: "s1", scopeId: "chap-2", kind: "rapprocher", impact: "x" },
      ])
    ).toEqual(original);
  });
});
