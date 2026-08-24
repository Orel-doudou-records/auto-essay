import { describe, expect, it } from "vitest";
import type { Manuscript, Source } from "../src/domain";
import type { SourceProfile } from "../src/domain/sourceProfile";
import {
  createBibliographyDistribution,
  BibliographyDistributionSchema,
} from "../src/domain/bibliographyDistribution";
import {
  collectDistributionNodes,
  distributeBibliography,
  distributeByKeywords,
  normalizeTerm,
  assertDistributionValid,
  projectBibliography,
  buildDistributePrompt,
} from "../src/bibliography/distribution";

const manuscript = {
  id: "m1",
  projectId: "p1",
  title: "Essai",
  tree: [
    {
      kind: "node" as const,
      id: "acte-1",
      title: "Acte I — La machine à différer",
      text: "La diaspora comme condition de l'archive.",
      children: [
        {
          kind: "leaf" as const,
          unitId: "u1",
          version: 1,
          id: "u1",
          title: "Chapitre 1 — Écrire après la machine",
        },
      ],
    },
    {
      kind: "node" as const,
      id: "chap-4",
      title: "Chapitre 4 — La Terre promise comme protocole",
      children: [],
    },
  ],
} as unknown as Manuscript;

const profiles: SourceProfile[] = [
  { sourceId: "src-1", subjects: ["diaspora"], concepts: ["archive"] },
  { sourceId: "src-2", subjects: ["philosophie"], concepts: ["langage"] },
];

const sources: Source[] = [
  { id: "src-1", type: "book" as const, title: "La diaspora", authors: ["A"], content: "" },
  { id: "src-2", type: "book" as const, title: "Philosophie", authors: ["B"], content: "" },
];

describe("normalizeTerm + collectDistributionNodes", () => {
  it("normalise casse et accents", () => {
    expect(normalizeTerm(" Mémoire ")).toBe("memoire");
  });

  it("collecte les nœuds (pas les feuilles)", () => {
    const nodes = collectDistributionNodes(manuscript.tree);
    expect(nodes.map((n) => n.id)).toEqual(["acte-1", "chap-4"]);
  });
});

describe("distributeByKeywords (mode pur)", () => {
  it("relie 'diaspora' au chapitre dont le titre contient le terme", () => {
    const nodes = collectDistributionNodes(manuscript.tree);
    const entries = distributeByKeywords(profiles[0], nodes);
    expect(entries.some((e) => e.scopeId === "acte-1")).toBe(true);
    expect(entries).toHaveLength(1);
  });

  it("relie aussi par correspondance de texte (confiance moindre)", () => {
    const nodes = collectDistributionNodes(manuscript.tree);
    const entries = distributeByKeywords(
      { sourceId: "src-x", subjects: ["archive"], concepts: [] },
      nodes
    );
    expect(entries[0].scopeId).toBe("acte-1");
    expect(entries[0].confidence).toBe(0.6);
  });

  it("ne produit rien si aucun terme ne matche", () => {
    const nodes = collectDistributionNodes(manuscript.tree);
    expect(distributeByKeywords(profiles[1], nodes)).toHaveLength(0);
  });
});

describe("distributeBibliography", () => {
  it("mode pur : sans client, mapping par mots-clés", async () => {
    const entries = await distributeBibliography(manuscript, profiles);
    expect(entries).toHaveLength(1);
    expect(entries[0].sourceId).toBe("src-1");
    expect(entries[0].scopeId).toBe("acte-1");
  });

  it("mode assisté : filtre les ids inconnus", async () => {
    const fake = {
      generateJson: async (): Promise<unknown> => ({
        entries: [
          { sourceId: "src-1", scopeId: "acte-1", rationale: "ok" },
          { sourceId: "inconnu", scopeId: "chap-4", rationale: "nok" },
          { sourceId: "src-2", scopeId: "absent", rationale: "nok" },
        ],
      }),
    };
    const entries = await distributeBibliography(manuscript, profiles, {
      client: fake,
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].sourceId).toBe("src-1");
  });

  it("buildDistributePrompt contient les scopes et les profils, pas le contenu", () => {
    const nodes = collectDistributionNodes(manuscript.tree);
    const prompt = buildDistributePrompt(nodes, profiles);
    expect(prompt).toContain("acte-1 | Acte I — La machine à différer");
    expect(prompt).toContain("src-1 | diaspora");
    expect(prompt).toContain('"entries"');
  });
});

describe("assertDistributionValid + projectBibliography", () => {
  it("refuse un scopeId inconnu", () => {
    expect(() =>
      assertDistributionValid(
        [{ sourceId: "src-1", scopeId: "absent" }],
        manuscript
      )
    ).toThrow("not found");
  });

  it("projette les sources par scope avec leur profil", () => {
    const entries = [{ sourceId: "src-1", scopeId: "acte-1" }];
    const projected = projectBibliography(manuscript, entries, sources, profiles);
    expect(projected).toHaveLength(1);
    expect(projected[0].scopeId).toBe("acte-1");
    expect(projected[0].sources[0].subjects).toEqual(["diaspora"]);
    expect(projected[0].sources[0].title).toBe("La diaspora");
  });
});

describe("BibliographyDistribution (domaine)", () => {
  it("refuse les doublons source↔scope", () => {
    const result = BibliographyDistributionSchema.safeParse({
      projectId: "p1",
      entries: [
        { sourceId: "a", scopeId: "n1" },
        { sourceId: "a", scopeId: "n1" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("crée une distribution vide", () => {
    const d = createBibliographyDistribution({ projectId: "p1" });
    expect(d.entries).toEqual([]);
  });
});