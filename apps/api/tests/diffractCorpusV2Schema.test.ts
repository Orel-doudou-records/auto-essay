import { describe, expect, it } from "vitest";
import { DiffractBodySchema } from "../src/schemas/diffract.js";

describe("Diffract Corpus V2 HTTP contract", () => {
  it("accepts projected passages and qualified documentary references", () => {
    const parsed = DiffractBodySchema.parse({
      statement: "Maintenir la contradiction documentaire.",
      bookBibliography: {
        entries: [{ sourceId: "source-a", title: "Archive A" }],
        passages: [
          {
            sourceId: "source-a",
            text: "La catégorie est décrite comme stable.",
            locator: "page:12",
            role: "supports",
            query: "stabilité de la catégorie",
          },
          {
            sourceId: "source-b",
            text: "Le témoignage conteste cette stabilité.",
            locator: "page:18",
            role: "contradicts",
            query: "stabilité de la catégorie",
          },
        ],
        citationIds: ["citation-a", "citation-b"],
        relationIds: ["relation-support", "relation-contradiction"],
        gaps: ["chronologie à qualifier"],
        unexploredAreas: ["contre-exemples supplémentaires"],
      },
    });

    expect(parsed.bookBibliography).toMatchObject({
      citationIds: ["citation-a", "citation-b"],
      relationIds: ["relation-support", "relation-contradiction"],
      gaps: ["chronologie à qualifier"],
      unexploredAreas: ["contre-exemples supplémentaires"],
    });
    expect(parsed.bookBibliography?.passages).toHaveLength(2);
  });

  it("does not expose the historical Graphify-neighborhood payload", () => {
    const parsed = DiffractBodySchema.parse({
      statement: "Fragment",
      bookBibliography: {
        entries: [],
        graphNeighborhoods: [{ term: "legacy", text: "graph signal" }],
      },
    });

    expect(parsed.bookBibliography).not.toHaveProperty("graphNeighborhoods");
  });
});
