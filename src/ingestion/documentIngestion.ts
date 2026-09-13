import { createHash } from "node:crypto";
import type { Source } from "../domain/source";
import {
  IngestedDocumentSchema,
  type IngestedBlock,
  type IngestedDocument,
} from "../domain/ingestedDocument";
import { importMarkdown, parseFrontmatter } from "./importers";

export interface MarkdownDocumentImport {
  source: Source;
  document: IngestedDocument;
}

export function fingerprintDocumentContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function createIngestedDocument(input: {
  sourceId: string;
  canonicalText: string;
  blocks: IngestedBlock[];
  ingestionStatus?: "ready" | "degraded" | "unreadable";
  diagnostics?: string[];
}): IngestedDocument {
  const fingerprint = fingerprintDocumentContent(input.canonicalText);
  const status =
    input.ingestionStatus ?? (input.blocks.length > 0 ? "ready" : "unreadable");
  const diagnostics =
    input.diagnostics ??
    (status === "unreadable" && input.blocks.length === 0
      ? ["No textual blocks were extracted"]
      : []);

  return IngestedDocumentSchema.parse({
    id: `${input.sourceId}:${fingerprint.slice(0, 16)}`,
    sourceId: input.sourceId,
    fingerprint,
    blocks: input.blocks,
    ingestionStatus: status,
    diagnostics,
  });
}

export function importMarkdownDocument(
  filePath: string,
  content: string,
  projectId: string
): MarkdownDocumentImport {
  const source = importMarkdown(filePath, content, projectId);
  const { body } = parseFrontmatter(content);
  const blocks = markdownBlocks(body, markdownBodyStartLine(content));
  const document = createIngestedDocument({
    sourceId: source.id,
    canonicalText: body,
    blocks,
  });

  return { source, document };
}

function markdownBodyStartLine(content: string): number {
  const prefix = /^---\s*\n[\s\S]*?\n---\s*\n/.exec(content)?.[0];
  return prefix ? prefix.split("\n").length : 1;
}

function markdownBlocks(body: string, firstLineNumber: number): IngestedBlock[] {
  const lines = body.split("\n");
  const blocks: IngestedBlock[] = [];
  const headings: string[] = [];
  let paragraph: string[] = [];
  let paragraphStart = 0;

  const currentSectionPath = (): string[] => headings.filter(Boolean);

  const pushBlock = (
    kind: string,
    text: string,
    startLine: number,
    endLine: number,
    sectionPath: string[]
  ): void => {
    const order = blocks.length;
    blocks.push({
      id: `block-${order}`,
      kind,
      order,
      text,
      sectionPath,
      locator: {
        kind: "other",
        value:
          startLine === endLine
            ? `line:${startLine}`
            : `line:${startLine}-${endLine}`,
      },
    });
  };

  const flushParagraph = (endIndexExclusive: number): void => {
    if (paragraph.length === 0) return;
    const startLine = firstLineNumber + paragraphStart;
    const endLine = firstLineNumber + endIndexExclusive - 1;
    pushBlock(
      "paragraph",
      paragraph.join("\n"),
      startLine,
      endLine,
      currentSectionPath()
    );
    paragraph = [];
  };

  for (const [index, line] of lines.entries()) {
    const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (heading) {
      flushParagraph(index);
      const level = heading[1].length;
      const title = heading[2].trim();
      headings.length = level;
      headings[level - 1] = title;
      pushBlock(
        "heading",
        title,
        firstLineNumber + index,
        firstLineNumber + index,
        currentSectionPath()
      );
      continue;
    }

    if (line.trim().length === 0) {
      flushParagraph(index);
      continue;
    }

    if (paragraph.length === 0) paragraphStart = index;
    paragraph.push(line);
  }

  flushParagraph(lines.length);
  return blocks;
}
