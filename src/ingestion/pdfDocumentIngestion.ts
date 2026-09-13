import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  IngestedDocumentSchema,
  type IngestedBlock,
  type IngestedDocument,
  type IngestionStatus,
} from "../domain/ingestedDocument";

const PdfExtractionPageSchema = z.object({
  number: z.number().int().positive(),
  text: z.string(),
});

const PdfExtractionOutputSchema = z.object({
  pageCount: z.number().int().nonnegative(),
  pages: z.array(PdfExtractionPageSchema),
  diagnostics: z.array(z.string()).default([]),
  fatal: z.boolean().default(false),
});

export async function importPdfDocument(
  filePath: string,
  sourceId: string
): Promise<IngestedDocument> {
  const fingerprint = await fingerprintPdfFile(filePath);
  const extraction = PdfExtractionOutputSchema.parse(
    JSON.parse(await runPdfExtractor(filePath))
  );

  const diagnostics = [...extraction.diagnostics];
  const pagesByNumber = [...extraction.pages].sort(
    (left, right) => left.number - right.number
  );
  const blocks: IngestedBlock[] = [];

  if (extraction.pageCount !== extraction.pages.length && !extraction.fatal) {
    diagnostics.push(
      `PDF parser reported ${extraction.pageCount} pages but returned ${extraction.pages.length}`
    );
  }

  for (const page of pagesByNumber) {
    const text = page.text.trim();
    if (text.length === 0) {
      diagnostics.push(`Page ${page.number} contains no extractable text`);
      continue;
    }

    blocks.push({
      id: `page-${page.number}`,
      kind: "page",
      order: page.number - 1,
      text,
      sectionPath: [],
      locator: { kind: "page", value: String(page.number) },
    });
  }

  const ingestionStatus = determinePdfIngestionStatus(
    extraction.fatal,
    extraction.pageCount,
    blocks.length,
    diagnostics.length
  );

  if (blocks.length === 0 && !diagnostics.some((item) => item.includes("extractable text"))) {
    diagnostics.push("No extractable text was found in the PDF");
  }

  return IngestedDocumentSchema.parse({
    id: `${sourceId}:${fingerprint.slice(0, 16)}`,
    sourceId,
    fingerprint,
    blocks,
    ingestionStatus,
    diagnostics,
  });
}

async function fingerprintPdfFile(filePath: string): Promise<string> {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) {
    digest.update(chunk);
  }
  return digest.digest("hex");
}

function determinePdfIngestionStatus(
  fatal: boolean,
  pageCount: number,
  blockCount: number,
  diagnosticCount: number
): IngestionStatus {
  if (fatal || pageCount === 0 || blockCount === 0) {
    return "unreadable";
  }
  if (blockCount < pageCount || diagnosticCount > 0) {
    return "degraded";
  }
  return "ready";
}

function runPdfExtractor(filePath: string): Promise<string> {
  const pythonExecutable =
    process.env.AUTO_ESSAY_PYTHON ??
    (process.platform === "win32" ? "python" : "python3");
  const extractorPath = fileURLToPath(
    new URL("../../scripts/pdf_text_extractor.py", import.meta.url)
  );

  return new Promise((resolve, reject) => {
    execFile(
      pythonExecutable,
      [extractorPath, filePath],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          const detail = stderr.trim() || error.message;
          reject(new Error(`PDF extraction worker failed: ${detail}`));
          return;
        }
        resolve(stdout);
      }
    );
  });
}
