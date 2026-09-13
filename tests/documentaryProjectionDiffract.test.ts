import { describe, expect, it } from "vitest";
import type { ProjectedScope } from "../src/bibliography/distribution";
import {
  bibliographyFromProjection,
  buildDiffractivePrompt,
} from "../src/editorial/diffractiveReader";

const projection: ProjectedScope = {
  scopeId: "chap-1",
  sources: [
    {
      sourceId: "src-1",
      title: "Archive",
      authors: ["A"],
      subjects: ["diaspora"],
      concepts: ["archive"],
    },
  ],
  passages: [
    {
      passage: {
        id: "passage-1",
        sourceId: "src-1",
        fingerprint: "a".repeat(64),
        span: {
          documentId: "doc-1",
          blockId: "page-42",
          start: 0,
          end: 23,
        },
        locator: { kind: "page", value: "42" },
        text: "Le passage contradictoire.",
        mode: "corroboration",
        probe: "contradiction",
      },
      role: "contradicts",
      query: "L'archive stabilise la mémoire.",
    },
  ],
  citationIds: ["cit-1"],
  sourceRelationIds: ["rel-1"],
  gaps: ["Manque une archive sonore."],
  unexploredAreas: ["Manque une archive sonore."],
};

describe("Diffract documentary projection", () => {
  it("consumes precise projected passages and gaps without doing retrieval", () => {
    const bibliography = bibliographyFromProjection(projection);
    const prompt = buildDiffractivePrompt({
      statement: "Fragment",
      bookBibliography: bibliography,
    });

    expect(bibliography.passages).toEqual([
      expect.objectContaining({
        sourceId: "src-1",
        role: "contradicts",
        locator: "page:42",
        text: "Le passage contradictoire.",
      }),
    ]);
    expect(prompt).toContain("## Matière documentaire du scope");
    expect(prompt).toContain("[contradicts] src-1 | page:42 | Le passage contradictoire.");
    expect(prompt).toContain("Citations vérifiées : cit-1");
    expect(prompt).toContain("Relations qualifiées : rel-1");
    expect(prompt).toContain("Manque une archive sonore.");
    expect(prompt).toContain("Diffract n'effectue aucun retrieval");
  });
});
