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

  it("construit la section avec la consigne de redistribution", () => {
    const section = buildBibliographySection(bibliography);
    expect(section).toContain("## La bibliothèque du chapitre");
    expect(section).toContain("redistribuer la bibliographie");
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
  const distribution = [
    { sourceId: "src-1", scopeId: "chap-2" },
    { sourceId: "src-2", scopeId: "chap-2" },
  ];

  it("redistribuer : déplace la source vers un autre scope", () => {
    const impacts: BibliographyImpact[] = [
      { sourceId: "src-1", scopeId: "chap-3", kind: "redistribuer", impact: "mieux ici" },
    ];
    const next = applyBibliographyImpacts(distribution, impacts);
    expect(next).toHaveLength(2);
    expect(next.find((e) => e.sourceId === "src-1")?.scopeId).toBe("chap-3");
    expect(distribution[0].scopeId).toBe("chap-2"); // pas de mutation
  });

  it("rapprocher : ajoute le lien s'il n'existe pas, sans dupliquer", () => {
    const impacts: BibliographyImpact[] = [
      { sourceId: "src-9", scopeId: "chap-2", kind: "rapprocher", impact: "pont" },
      { sourceId: "src-9", scopeId: "chap-2", kind: "rapprocher", impact: "duplicata" },
    ];
    const next = applyBibliographyImpacts(distribution, impacts);
    const links = next.filter((e) => e.sourceId === "src-9");
    expect(links).toHaveLength(1);
    expect(links[0].confidence).toBe(0.7);
  });

  it("manquante : ajoute un lien avec confiance faible (signal)", () => {
    const impacts: BibliographyImpact[] = [
      { sourceId: "src-9", scopeId: "chap-4", kind: "manquante", impact: "source absente" },
    ];
    const next = applyBibliographyImpacts(distribution, impacts);
    expect(next).toHaveLength(3);
    expect(next[2].confidence).toBe(0.4);
  });
});