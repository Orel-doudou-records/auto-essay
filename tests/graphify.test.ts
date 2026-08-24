import { describe, expect, it } from "vitest";
import {
  KnowledgeGraphSchema,
  findNode,
  formatNeighborhood,
  parseKnowledgeGraph,
  qualifyGraphSignal,
  queryNeighborhood,
  shortestPath,
  type KnowledgeGraph,
} from "../src/bibliography/graphify";

// Fixture représentative du graph.json produit par graphify (format réel).
const fixture: KnowledgeGraph = {
  nodes: [
    { id: "isaac_asimov", label: "Isaac Asimov", file_type: "concept", source_file: "asimov.md" },
    { id: "golem", label: "Og ha-Golem", file_type: "concept", source_file: "wandering.md" },
    { id: "shekhina", label: "Shekhina", file_type: "concept", source_file: "wandering.md" },
    { id: "diaspora", label: "Diaspora", file_type: "concept", source_file: "essai.md" },
    { id: "star_trek", label: "Star Trek", file_type: "concept", source_file: "trek.md" },
    { id: "mitochondrie", label: "Mitochondrie", file_type: "concept", source_file: "bio.md" },
  ],
  links: [
    { source: "isaac_asimov", target: "golem", relation: "conceptually_related_to", confidence: "INFERRED", confidence_score: 0.7 },
    { source: "golem", target: "shekhina", relation: "references", confidence: "EXTRACTED", confidence_score: 1 },
    { source: "shekhina", target: "diaspora", relation: "conceptually_related_to", confidence: "INFERRED", confidence_score: 0.6 },
    { source: "diaspora", target: "star_trek", relation: "conceptually_related_to", confidence: "INFERRED", confidence_score: 0.8 },
  ],
};

describe("parseKnowledgeGraph + findNode", () => {
  it("parse un graph.json bruts (et tolère les champs extra)", () => {
    const raw = JSON.parse(
      JSON.stringify({ ...fixture, metadata: { count: 6 } })
    );
    const parsed = parseKnowledgeGraph(raw);
    expect(parsed.nodes).toHaveLength(6);
    expect(parsed.links).toHaveLength(4);
  });

  it("refuse un graphe mal formé", () => {
    expect(KnowledgeGraphSchema.safeParse({ nodes: [{ id: 1 }], links: [] }).success).toBe(false);
  });

  it("trouve le meilleur nœud par label (insensible à la casse)", () => {
    expect(findNode(fixture, "golem")?.id).toBe("golem");
    expect(findNode(fixture, "asimov")?.id).toBe("isaac_asimov");
  });
});

describe("queryNeighborhood (BFS budgeté)", () => {
  it("explore le voisinage en profondeur 2", () => {
    const hood = queryNeighborhood(fixture, "golem", { depth: 2 });
    expect(hood.nodes.map((n) => n.id).sort()).toEqual(
      ["diaspora", "golem", "isaac_asimov", "shekhina"]
    );
    expect(hood.nodes.some((n) => n.id === "star_trek")).toBe(false);
  });

  it("respecte maxNodes", () => {
    const hood = queryNeighborhood(fixture, "golem", { depth: 3, maxNodes: 3 });
    expect(hood.nodes.length).toBeLessThanOrEqual(3);
  });

  it("formate le voisinage de façon compacte", () => {
    const hood = queryNeighborhood(fixture, "golem", { depth: 1 });
    const text = formatNeighborhood(hood);
    expect(text).toContain("Isaac Asimov");
    expect(text).toContain("--references [EXTRACTED 1]-->");
  });
});

describe("shortestPath", () => {
  it("trouve le chemin entre deux concepts connectés", () => {
    const path = shortestPath(fixture, "asimov", "diaspora");
    expect(path?.map((n) => n.id)).toEqual(["isaac_asimov", "golem", "shekhina", "diaspora"]);
  });

  it("renvoie undefined pour des nœuds déconnectés ou inconnus", () => {
    expect(shortestPath(fixture, "asimov", "mitochondrie")).toBeUndefined();
    expect(shortestPath(fixture, "asimov", "introuvable")).toBeUndefined();
  });
});

describe("qualifyGraphSignal (frontière sémantique)", () => {
  it("accepte un rapprochement et produit un impact de kind rapprocher", async () => {
    const fake = {
      generateJson: async (): Promise<unknown> => ({
        accepted: true,
        impact: {
          sourceId: "src-1",
          scopeId: "chap-2",
          impact: "Le golem relie la tradition au technique.",
        },
        rationale: "Le chemin est fondé par deux arêtes EXTRACTED.",
      }),
    };
    const qualified = await qualifyGraphSignal(
      "Voisinage du graphe (3 nœuds, 2 arêtes) :",
      fake
    );
    expect(qualified.accepted).toBe(true);
    expect(qualified.impact?.kind).toBe("rapprocher");
    expect(qualified.impact?.scopeId).toBe("chap-2");
  });

  it("rejette un signal sans impact", async () => {
    const fake = {
      generateJson: async (): Promise<unknown> => ({
        accepted: false,
        rationale: "Rapprochement trop spéculatif.",
      }),
    };
    const qualified = await qualifyGraphSignal("signal", fake);
    expect(qualified.accepted).toBe(false);
    expect(qualified.impact).toBeUndefined();
  });
});