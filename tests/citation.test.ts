import { describe, expect, it } from "vitest";
import type { Manuscript, Source } from "../src/domain";
import type { Citation, CitationUse } from "../src/domain/citation";
import { createContentRelation } from "../src/domain/contentRelation";
import type { RetrievedPassage } from "../src/bibliography/corpusExplorer";
import {
  assertCiteable,
  assertVerifiedRelationCitations,
  citationsForUnit,
  findUnitScope,
  formatCitation,
  promoteRetrievedPassageToCitation,
  sourceYear,
} from "../src/bibliography/citation";

const manuscript = {
  id: "m1",
  projectId: "p1",
  title: "Essai",
  tree: [
    {
      kind: "node" as const,
      id: "chap-2",
      title: "Chapitre 2 — Le salon",
      children: [],
      plan: [{ id: "e1", subject: "Le salon", unitId: "u-par", unitVersion: 1 }],
    },
    {
      kind: "node" as const,
      id: "acte-3",
      title: "Acte III",
      children: [
        {
          kind: "leaf" as const,
          unitId: "u-feuille",
          version: 2,
        },
      ],
    },
  ],
} as unknown as Manuscript;

const distribution = [
  { sourceId: "src-1", scopeId: "chap-2" },
  { sourceId: "src-2", scopeId: "chap-2" },
];

const citations: Citation[] = [
  {
    id: "cit-1",
    projectId: "p1",
    sourceId: "src-1",
    quote: "…",
    locator: { kind: "section", value: "3" },
    verificationStatus: "verified",
    createdAt: "2026-08-24T12:00:00.000Z",
  },
  {
    id: "cit-2",
    projectId: "p1",
    sourceId: "src-9",
    quote: "…",
    locator: { kind: "section", value: "1" },
    verificationStatus: "unverified",
    createdAt: "2026-08-24T12:00:00.000Z",
  },
];

const uses: CitationUse[] = [
  { citationId: "cit-1", draftUnitId: "u-par", draftUnitVersion: 1 },
  { citationId: "cit-2", draftUnitId: "u-par", draftUnitVersion: 1 },
];

describe("RetrievedPassage -> Citation", () => {
  const passage: RetrievedPassage = {
    id: "doc-1:aaaaaaaaaaaaaaaa:block-1:0-14",
    sourceId: "src-1",
    fingerprint: "a".repeat(64),
    span: {
      documentId: "doc-1",
      blockId: "block-1",
      start: 0,
      end: 14,
    },
    locator: { kind: "page", value: "42" },
    text: "Archive phrase",
    mode: "corroboration",
    probe: "support",
    reason: "test",
  };

  it("promotes exact passage provenance without treating retrieval as verification", () => {
    const citation = promoteRetrievedPassageToCitation({
      projectId: "p1",
      passage,
      verificationStatus: "verified",
      citationId: "cit-promoted",
      createdAt: "2026-09-13T12:00:00.000Z",
    });

    expect(citation).toMatchObject({
      id: "cit-promoted",
      sourceId: "src-1",
      quote: "Archive phrase",
      locator: { kind: "page", value: "42" },
      verificationStatus: "verified",
      retrievalProvenance: {
        retrievedPassageId: passage.id,
        documentId: "doc-1",
        blockId: "block-1",
        start: 0,
        end: 14,
        documentFingerprint: "a".repeat(64),
      },
    });
  });

  it("allows one verified citation to ground different argumentative relations", () => {
    const citation = promoteRetrievedPassageToCitation({
      projectId: "p1",
      passage,
      verificationStatus: "verified",
      citationId: "cit-shared",
    });
    const relations = (["supports", "qualifies", "contradicts"] as const).map(
      (type, index) =>
        createContentRelation({
          scope: { level: "project", projectId: "p1" },
          type,
          participants: [
            { kind: "claim", id: `claim-a-${index}` },
            { kind: "claim", id: `claim-b-${index}` },
          ],
          description: `${type} relation`,
          citationIds: [citation.id],
          origin: "co_constructed",
        })
    );

    for (const relation of relations) {
      expect(() => assertVerifiedRelationCitations(relation, [citation])).not.toThrow();
      expect(relation.citationIds).toEqual([citation.id]);
    }
  });

  it("refuses unverified citations as functional argumentative grounding", () => {
    const citation = promoteRetrievedPassageToCitation({
      projectId: "p1",
      passage,
      verificationStatus: "unverified",
      citationId: "cit-unverified-passage",
    });
    const relation = createContentRelation({
      scope: { level: "project", projectId: "p1" },
      type: "supports",
      participants: [
        { kind: "source", id: "src-1" },
        { kind: "claim", id: "claim-1" },
      ],
      description: "Support candidate",
      citationIds: [citation.id],
      origin: "system_detected",
    });

    expect(() => assertVerifiedRelationCitations(relation, [citation])).toThrow(
      "non-verified citation 'cit-unverified-passage'"
    );
  });
});

describe("findUnitScope", () => {
  it("résout le scope d'une unité liée à une entrée de plan (E4)", () => {
    expect(findUnitScope(manuscript, "u-par")).toBe("chap-2");
  });

  it("résout le scope d'une feuille = son nœud parent (T1)", () => {
    expect(findUnitScope(manuscript, "u-feuille")).toBe("acte-3");
  });

  it("renvoie undefined pour une unité inconnue", () => {
    expect(findUnitScope(manuscript, "absent")).toBeUndefined();
  });
});

describe("citationsForUnit + assertCiteable", () => {
  it("filtre les usages par unité", () => {
    expect(citationsForUnit("u-par", uses).map((u) => u.citationId)).toEqual([
      "cit-1",
      "cit-2",
    ]);
  });

  it("accepte une citation dont la source est distribuée sur le scope", () => {
    expect(() =>
      assertCiteable(manuscript, "u-par", distribution, [uses[0]], citations)
    ).not.toThrow();
  });

  it("refuse une citation dont la source n'est pas distribuée sur le scope", () => {
    expect(() =>
      assertCiteable(manuscript, "u-par", distribution, uses, citations)
    ).toThrow("not distributed on scope 'chap-2'");
  });

  it("ne vérifie rien si l'unité n'a pas de scope", () => {
    expect(() =>
      assertCiteable(manuscript, "absente", distribution, uses, citations)
    ).not.toThrow();
  });
});

describe("sourceYear + formatCitation", () => {
  const source: Source = {
    id: "src-1",
    type: "book",
    title: "More Wandering Stars",
    authors: ["Jack Dann"],
    content: "",
    publicationDate: "1981-06-01",
    publisher: "Bantam",
    projectId: "p1",
  };

  it("extrait l'année de publicationDate", () => {
    expect(sourceYear(source)).toBe("1981");
    expect(sourceYear({ ...source, publicationDate: undefined })).toBe("s.d.");
  });

  it("formate en parenthetical (Auteur, année)", () => {
    expect(formatCitation(source)).toBe("(Jack Dann, 1981)");
  });

  it("formate en note de bas de page", () => {
    expect(formatCitation(source, "footnote")).toBe(
      "Jack Dann, More Wandering Stars, Bantam, 1981."
    );
  });
});
