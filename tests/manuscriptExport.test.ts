import { describe, expect, it } from "vitest";
import {
  CitationSchema,
  createDraftUnit,
  createManuscript,
  createSource,
} from "../src/domain";
import { compileManuscript } from "../src";

const projectId = "project-1";

function citationFor(sourceId: string, id: string) {
  return CitationSchema.parse({
    id,
    projectId,
    sourceId,
    quote: "Une citation vérifiée.",
    locator: { kind: "page", value: "1" },
    verificationStatus: "verified",
    createdAt: "2026-07-21T10:00:00.000Z",
  });
}

describe("compileManuscript", () => {
  it("est exposée par l'API publique", () => {
    expect(compileManuscript).toBeTypeOf("function");
  });

  it("compile les unités ordonnées et déduplique les sources dans leur ordre d'apparition", () => {
    const sourceWithDoi = createSource({
      projectId,
      type: "article",
      title: "Notes on the Analytical Engine",
      content: "Contenu source",
      authors: ["Ada Lovelace"],
      publicationDate: "1843",
      publisher: "Science Press",
      doi: " doi: 10.1000/xyz ",
      url: "https://example.test/ignored-by-doi",
    });
    const sourceWithoutDate = createSource({
      projectId,
      type: "note",
      title: "Untitled source",
      content: "Autre contenu source",
      publisher: "Archive",
      url: "https://example.test/source",
    });
    const firstCitation = citationFor(sourceWithDoi.id, "citation-1");
    const secondCitation = citationFor(sourceWithoutDate.id, "citation-2");
    const reusedCitation = citationFor(sourceWithDoi.id, "citation-3");

    const introduction = createDraftUnit({
      projectId,
      granularity: "section",
      content: "Introduction étayée.",
    });
    introduction.citationUses = [
      {
        citationId: firstCitation.id,
        draftUnitId: introduction.id,
        draftUnitVersion: introduction.version,
      },
    ];
    const conclusion = createDraftUnit({
      projectId,
      granularity: "section",
      content: "Conclusion étayée.",
    });
    conclusion.citationUses = [
      {
        citationId: secondCitation.id,
        draftUnitId: conclusion.id,
        draftUnitVersion: conclusion.version,
      },
      {
        citationId: reusedCitation.id,
        draftUnitId: conclusion.id,
        draftUnitVersion: conclusion.version,
      },
    ];
    const manuscript = createManuscript({
      projectId,
      title: "Essai compilé",
      units: [
        { unitId: conclusion.id, version: conclusion.version, order: 1 },
        { unitId: introduction.id, version: introduction.version, order: 0 },
      ],
    });

    const result = compileManuscript(
      manuscript,
      [conclusion, introduction],
      [firstCitation, secondCitation, reusedCitation],
      [sourceWithDoi, sourceWithoutDate]
    );

    expect(result.sources).toEqual([sourceWithDoi, sourceWithoutDate]);
    expect(result.markdown).toBe(
      "# Essai compilé\n\n" +
        "Introduction étayée.\n\n" +
        "Conclusion étayée.\n\n" +
        "## Références\n\n" +
        "Lovelace, A. (1843). Notes on the Analytical Engine. Science Press. https://doi.org/10.1000/xyz\n" +
        "Untitled source. (n.d.). Archive. https://example.test/source"
    );
  });

  it("refuse une unité ou version introuvable", () => {
    const manuscript = createManuscript({
      projectId,
      title: "Essai incomplet",
      units: [{ unitId: "unit-conclusion", version: 2, order: 0 }],
    });

    expect(() => compileManuscript(manuscript, [], [], [])).toThrow(
      "unit-conclusion@2"
    );
  });

  it("refuse une citation utilisée mais absente", () => {
    const unit = createDraftUnit({
      projectId,
      granularity: "paragraph",
      content: "Texte sourcé.",
    });
    unit.citationUses = [
      {
        citationId: "citation-absente",
        draftUnitId: unit.id,
        draftUnitVersion: unit.version,
      },
    ];
    const manuscript = createManuscript({
      projectId,
      title: "Essai incomplet",
      units: [{ unitId: unit.id, version: unit.version, order: 0 }],
    });

    expect(() => compileManuscript(manuscript, [unit], [], [])).toThrow(
      "citation-absente"
    );
  });

  it("refuse un usage de citation muté qui cible une autre unité ou version", () => {
    const source = createSource({
      projectId,
      type: "note",
      title: "Source",
      content: "Contenu source",
    });
    const citation = citationFor(source.id, "citation-1");
    const unit = createDraftUnit({
      projectId,
      granularity: "paragraph",
      content: "Texte sourcé.",
    });
    unit.citationUses = [
      {
        citationId: citation.id,
        draftUnitId: "autre-unité",
        draftUnitVersion: unit.version + 1,
      },
    ];
    const manuscript = createManuscript({
      projectId,
      title: "Essai incomplet",
      units: [{ unitId: unit.id, version: unit.version, order: 0 }],
    });

    expect(() =>
      compileManuscript(manuscript, [unit], [citation], [source])
    ).toThrow(`${unit.id}@${unit.version}`);
  });

  it("refuse une plage de caractères au-delà du contenu", () => {
    const source = createSource({
      projectId,
      type: "note",
      title: "Source",
      content: "Contenu source",
    });
    const citation = citationFor(source.id, "citation-1");
    const unit = createDraftUnit({
      projectId,
      granularity: "paragraph",
      content: "Texte.",
    });
    unit.citationUses = [
      {
        citationId: citation.id,
        draftUnitId: unit.id,
        draftUnitVersion: unit.version,
        characterRange: { start: 0, end: unit.content.length + 1 },
      },
    ];
    const manuscript = createManuscript({
      projectId,
      title: "Essai incomplet",
      units: [{ unitId: unit.id, version: unit.version, order: 0 }],
    });

    expect(() =>
      compileManuscript(manuscript, [unit], [citation], [source])
    ).toThrow("character range");
  });

  it("formate les auteurs APA et ne répète pas le titre sans auteur", () => {
    const sources = [
      createSource({
        projectId,
        type: "note",
        title: "One author",
        content: "Contenu",
        authors: ["Jane Doe"],
        publicationDate: "2024",
        publisher: "Press",
      }),
      createSource({
        projectId,
        type: "note",
        title: "Two authors",
        content: "Contenu",
        authors: ["Jane Doe", "John Smith"],
        publicationDate: "2024",
      }),
      createSource({
        projectId,
        type: "note",
        title: "Three authors",
        content: "Contenu",
        authors: ["Jane Doe", "John Smith", "Alex Johnson"],
        publicationDate: "2024",
      }),
      createSource({
        projectId,
        type: "note",
        title: "Untitled source",
        content: "Contenu",
        publisher: "Archive",
      }),
    ];
    const citations = sources.map((source, index) =>
      citationFor(source.id, `citation-${index}`)
    );
    const unit = createDraftUnit({
      projectId,
      granularity: "paragraph",
      content: "Texte sourcé.",
    });
    unit.citationUses = citations.map((citation) => ({
      citationId: citation.id,
      draftUnitId: unit.id,
      draftUnitVersion: unit.version,
    }));
    const manuscript = createManuscript({
      projectId,
      title: "Références APA",
      units: [{ unitId: unit.id, version: unit.version, order: 0 }],
    });

    const result = compileManuscript(manuscript, [unit], citations, sources);

    expect(result.markdown).toContain(
      "Doe, J. (2024). One author. Press.\n" +
        "Doe, J., & Smith, J. (2024). Two authors.\n" +
        "Doe, J., Smith, J., & Johnson, A. (2024). Three authors.\n" +
        "Untitled source. (n.d.). Archive."
    );
  });

  it("refuse une citation ou source d'un autre projet", () => {
    const unit = createDraftUnit({
      projectId,
      granularity: "paragraph",
      content: "Texte sourcé.",
    });
    const manuscript = createManuscript({
      projectId,
      title: "Essai incomplet",
      units: [{ unitId: unit.id, version: unit.version, order: 0 }],
    });
    const foreignCitation = CitationSchema.parse({
      ...citationFor("source-1", "citation-étrangère"),
      projectId: "project-2",
    });
    unit.citationUses = [
      {
        citationId: foreignCitation.id,
        draftUnitId: unit.id,
        draftUnitVersion: unit.version,
      },
    ];

    expect(() =>
      compileManuscript(manuscript, [unit], [foreignCitation], [])
    ).toThrow("another project");

    const foreignSource = createSource({
      projectId: "project-2",
      type: "note",
      title: "Source étrangère",
      content: "Contenu",
    });
    const localCitation = citationFor(foreignSource.id, "citation-locale");
    unit.citationUses = [
      {
        citationId: localCitation.id,
        draftUnitId: unit.id,
        draftUnitVersion: unit.version,
      },
    ];

    expect(() =>
      compileManuscript(manuscript, [unit], [localCitation], [foreignSource])
    ).toThrow("another project");
  });

  it("refuse un enregistrement de citation ambigu", () => {
    const source = createSource({
      projectId,
      type: "note",
      title: "Source",
      content: "Contenu",
    });
    const citation = citationFor(source.id, "citation-dupliquée");
    const unit = createDraftUnit({
      projectId,
      granularity: "paragraph",
      content: "Texte sourcé.",
    });
    unit.citationUses = [
      {
        citationId: citation.id,
        draftUnitId: unit.id,
        draftUnitVersion: unit.version,
      },
    ];
    const manuscript = createManuscript({
      projectId,
      title: "Essai incomplet",
      units: [{ unitId: unit.id, version: unit.version, order: 0 }],
    });

    expect(() =>
      compileManuscript(manuscript, [unit], [citation, { ...citation }], [source])
    ).toThrow("ambiguous");
  });
});
