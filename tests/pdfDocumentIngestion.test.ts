import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readIngestedSpan } from "../src/domain/ingestedDocument";
import {
  fingerprintDocumentBytes,
  importPdfDocument,
} from "../src/ingestion/pdfDocumentIngestion";

describe("PDF documentary ingestion", () => {
  it("ingests a real multi-page PDF with byte fingerprint and exact page provenance", async () => {
    const bytes = buildPdf([
      "The first page introduces the archive.",
      "The second page contains the exact target phrase.",
    ]);

    await withTemporaryPdf(bytes, async (filePath) => {
      const document = await importPdfDocument(filePath, "source-pdf-1");

      expect(document.ingestionStatus).toBe("ready");
      expect(document.fingerprint).toBe(fingerprintDocumentBytes(bytes));
      expect(document.blocks).toHaveLength(2);
      expect(document.blocks[0]).toMatchObject({
        id: "page-1",
        kind: "page",
        order: 0,
        locator: { kind: "page", value: "1" },
        sectionPath: [],
      });
      expect(document.blocks[1]).toMatchObject({
        id: "page-2",
        kind: "page",
        order: 1,
        locator: { kind: "page", value: "2" },
        sectionPath: [],
      });

      const pageTwo = document.blocks[1]!;
      const phrase = "exact target phrase";
      const start = pageTwo.text.indexOf(phrase);
      expect(start).toBeGreaterThanOrEqual(0);
      expect(
        readIngestedSpan(document, {
          documentId: document.id,
          blockId: pageTwo.id,
          start,
          end: start + phrase.length,
        })
      ).toBe(phrase);
    });
  });

  it("marks partial text extraction degraded and identifies the empty page", async () => {
    const bytes = buildPdf(["Readable first page.", null]);

    await withTemporaryPdf(bytes, async (filePath) => {
      const document = await importPdfDocument(filePath, "source-pdf-partial");

      expect(document.ingestionStatus).toBe("degraded");
      expect(document.blocks.map((block) => block.locator.value)).toEqual(["1"]);
      expect(document.diagnostics).toContain("Page 2 contains no extractable text");
    });
  });

  it("never declares an image-only or empty-text PDF ready", async () => {
    const bytes = buildPdf([null, null]);

    await withTemporaryPdf(bytes, async (filePath) => {
      const document = await importPdfDocument(filePath, "source-pdf-scan");

      expect(document.ingestionStatus).toBe("unreadable");
      expect(document.blocks).toEqual([]);
      expect(document.diagnostics).toEqual(
        expect.arrayContaining([
          "Page 1 contains no extractable text",
          "Page 2 contains no extractable text",
        ])
      );
    });
  });

  it("represents a corrupt PDF as unreadable rather than as an empty ready document", async () => {
    const bytes = Buffer.from("not-a-pdf", "utf8");

    await withTemporaryPdf(bytes, async (filePath) => {
      const document = await importPdfDocument(filePath, "source-pdf-corrupt");

      expect(document.ingestionStatus).toBe("unreadable");
      expect(document.blocks).toEqual([]);
      expect(document.diagnostics.some((item) => item.startsWith("PDF parse failed:"))).toBe(
        true
      );
    });
  });
});

async function withTemporaryPdf(
  bytes: Uint8Array,
  assertion: (filePath: string) => Promise<void>
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "auto-essay-pdf-"));
  const filePath = join(directory, "fixture.pdf");
  try {
    await writeFile(filePath, bytes);
    await assertion(filePath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function buildPdf(pageTexts: Array<string | null>): Buffer {
  const pageObjectIds = pageTexts.map((_, index) => 3 + index * 2);
  const contentObjectIds = pageTexts.map((_, index) => 4 + index * 2);
  const fontObjectId = 3 + pageTexts.length * 2;
  const objects = new Map<number, string>();

  objects.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objects.set(
    2,
    `<< /Type /Pages /Kids [${pageObjectIds
      .map((id) => `${id} 0 R`)
      .join(" ")}] /Count ${pageTexts.length} >>`
  );

  pageTexts.forEach((text, index) => {
    const pageId = pageObjectIds[index]!;
    const contentId = contentObjectIds[index]!;
    const stream =
      text === null
        ? ""
        : `BT\n/F1 12 Tf\n72 720 Td\n(${escapePdfText(text)}) Tj\nET\n`;

    objects.set(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    objects.set(
      contentId,
      `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}endstream`
    );
  });

  objects.set(
    fontObjectId,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  );

  let pdf = "%PDF-1.4\n%AutoEssay\n";
  const offsets: number[] = [0];
  for (let id = 1; id <= fontObjectId; id += 1) {
    offsets[id] = Buffer.byteLength(pdf, "ascii");
    pdf += `${id} 0 obj\n${objects.get(id)}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${fontObjectId + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let id = 1; id <= fontObjectId; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${fontObjectId + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "ascii");
}

function escapePdfText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
