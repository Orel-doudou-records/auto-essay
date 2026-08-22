import { describe, expect, it } from "vitest";
import {
  CitationSchema,
  CitationUseSchema,
} from "../src/domain/citation";
import { createDraftUnit, DraftUnitSchema } from "../src/domain/draftUnit";

describe("Citation", () => {
  it("parses a verified citation with a page locator", () => {
    const citation = CitationSchema.parse({
      id: "citation-1",
      projectId: "project-1",
      sourceId: "source-1",
      quote: "A verified quotation.",
      locator: { kind: "page", value: "42" },
      verificationStatus: "verified",
      createdAt: "2026-07-21T10:00:00.000Z",
    });

    expect(citation.locator).toEqual({ kind: "page", value: "42" });
    expect(citation.verificationStatus).toBe("verified");
  });

  it("parses a citation use with a valid character range", () => {
    expect(
      CitationUseSchema.parse({
        citationId: "citation-1",
        draftUnitId: "draft-unit-1",
        draftUnitVersion: 1,
        characterRange: { start: 0, end: 24 },
      })
    ).toEqual({
      citationId: "citation-1",
      draftUnitId: "draft-unit-1",
      draftUnitVersion: 1,
      characterRange: { start: 0, end: 24 },
    });
  });

  it("rejects a citation use whose character range is empty", () => {
    expect(() =>
      CitationUseSchema.parse({
        citationId: "citation-1",
        draftUnitId: "draft-unit-1",
        draftUnitVersion: 1,
        characterRange: { start: 12, end: 12 },
      })
    ).toThrow();
  });

  it("gives new draft units no citation uses by default", () => {
    const unit = createDraftUnit({
      projectId: "project-1",
      granularity: "paragraph",
    });

    expect(unit.citationUses).toEqual([]);
  });

  it("normalizes citation uses passed to the draft unit factory", () => {
    const citationUses = [
      {
        citationId: "citation-1",
        draftUnitId: "other-draft-unit",
        draftUnitVersion: 99,
        characterRange: { start: 3, end: 18 },
      },
    ];

    const unit = createDraftUnit({
      projectId: "project-1",
      granularity: "paragraph",
      citationUses,
    });

    expect(unit.citationUses).toEqual([
      {
        citationId: "citation-1",
        draftUnitId: unit.id,
        draftUnitVersion: unit.version,
        characterRange: { start: 3, end: 18 },
      },
    ]);
  });

  it("rejects a draft unit whose citation use targets another unit or version", () => {
    const unit = createDraftUnit({
      projectId: "project-1",
      granularity: "paragraph",
    });

    const result = DraftUnitSchema.safeParse({
      ...unit,
      citationUses: [
        {
          citationId: "citation-1",
          draftUnitId: "other-draft-unit",
          draftUnitVersion: unit.version + 1,
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});
