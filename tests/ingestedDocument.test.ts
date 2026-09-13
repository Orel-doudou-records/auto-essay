import { describe, expect, it } from "vitest";
import {
  IngestedDocumentSchema,
  readIngestedSpan,
} from "../src/domain/ingestedDocument";
import {
  fingerprintDocumentContent,
  importMarkdownDocument,
} from "../src/ingestion/documentIngestion";

describe("IngestedDocument", () => {
  it("fingerprints documentary content deterministically", () => {
    expect(fingerprintDocumentContent("same text")).toBe(
      fingerprintDocumentContent("same text")
    );
    expect(fingerprintDocumentContent("same text")).not.toBe(
      fingerprintDocumentContent("changed text")
    );
  });

  it("rejects ready documents without addressable blocks", () => {
    expect(() =>
      IngestedDocumentSchema.parse({
        id: "doc-1",
        sourceId: "source-1",
        fingerprint: "a".repeat(64),
        blocks: [],
        ingestionStatus: "ready",
      })
    ).toThrow();
  });

  it("reads an exact span from its canonical block", () => {
    const document = IngestedDocumentSchema.parse({
      id: "doc-1",
      sourceId: "source-1",
      fingerprint: "a".repeat(64),
      ingestionStatus: "ready",
      blocks: [
        {
          id: "block-0",
          kind: "paragraph",
          order: 0,
          text: "Archive institutions classify populations.",
          locator: { kind: "other", value: "line:1" },
        },
      ],
    });

    expect(
      readIngestedSpan(document, {
        documentId: document.id,
        blockId: "block-0",
        start: 0,
        end: 7,
      })
    ).toBe("Archive");
  });
});

describe("Markdown documentary ingestion", () => {
  it("keeps the historical Source while producing ordered provenance-bearing blocks", () => {
    const content = `---
title: Corpus note
---
# Introduction

First paragraph
continues here.

## Detail

Second paragraph.`;

    const { source, document } = importMarkdownDocument(
      "corpus-note.md",
      content,
      "project-1"
    );

    expect(source.title).toBe("Corpus note");
    expect(source.content).toContain("First paragraph");
    expect(document.sourceId).toBe(source.id);
    expect(document.ingestionStatus).toBe("ready");
    expect(document.blocks.map((block) => block.order)).toEqual([0, 1, 2, 3]);
    expect(document.blocks[0]).toMatchObject({
      kind: "heading",
      text: "Introduction",
      sectionPath: ["Introduction"],
      locator: { kind: "other", value: "line:4" },
    });
    expect(document.blocks[1]).toMatchObject({
      kind: "paragraph",
      text: "First paragraph\ncontinues here.",
      sectionPath: ["Introduction"],
      locator: { kind: "other", value: "line:6-7" },
    });
    expect(document.blocks[3]?.sectionPath).toEqual(["Introduction", "Detail"]);

    expect(
      readIngestedSpan(document, {
        documentId: document.id,
        blockId: document.blocks[1]!.id,
        start: 0,
        end: 5,
      })
    ).toBe("First");
  });

  it("marks an empty documentary body unreadable instead of ready", () => {
    const { document } = importMarkdownDocument(
      "empty.md",
      "---\ntitle: Empty\n---\n",
      "project-1"
    );

    expect(document.ingestionStatus).toBe("unreadable");
    expect(document.blocks).toEqual([]);
    expect(document.diagnostics).toEqual(["No textual blocks were extracted"]);
  });
});
