import { z } from "zod";
import { parseFrontmatter } from "./importers";

export const ManuscriptImportAnnotationSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("link"),
    label: z.string().trim().min(1).max(1_000),
    url: z.string().url().max(2_048),
  }),
  z.object({
    kind: z.literal("comment"),
    content: z.string().trim().min(1).max(10_000),
  }),
]);

export type ManuscriptImportAnnotation = z.infer<typeof ManuscriptImportAnnotationSchema>;

export const ManuscriptImportSectionSchema = z.object({
  id: z.string().min(1).max(255),
  title: z.string().trim().min(1, "Chaque section doit avoir un titre.").max(500),
  content: z.string().max(5_000_000),
  level: z.number().int().min(1).max(6),
  annotations: z.array(ManuscriptImportAnnotationSchema).max(1_000).default([]),
});

export type ManuscriptImportSection = z.infer<typeof ManuscriptImportSectionSchema>;

export const ManuscriptImportPreviewSchema = z.object({
  title: z.string().trim().min(1, "Le manuscrit doit avoir un titre.").max(500),
  sections: z.array(ManuscriptImportSectionSchema).min(1).max(500),
}).superRefine((preview, context) => {
  const previewBytes = new TextEncoder().encode(JSON.stringify(preview)).byteLength;
  if (previewBytes > 5_000_000) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [],
      message: "L’aperçu dépasse la taille maximale de 5 Mo.",
    });
  }
});

export type ManuscriptImportPreview = z.infer<typeof ManuscriptImportPreviewSchema>;

export function previewMarkdownManuscript(name: string, content: string): ManuscriptImportPreview {
  const { title, body } = readDocumentTitle(name, content);
  const sections: ManuscriptImportSection[] = [];
  let current: { title: string; level: number; lines: string[] } | undefined;
  const preamble: string[] = [];
  let fencedCode = false;

  const flush = () => {
    if (!current) return;
    sections.push(
      ManuscriptImportSectionSchema.parse({
        id: crypto.randomUUID(),
        title: current.title,
        level: current.level,
        ...extractAnnotations(current.lines.join("\n")),
      })
    );
    current = undefined;
  };

  for (const line of body.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) fencedCode = !fencedCode;
    const heading = !fencedCode ? line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/) : undefined;
    if (heading) {
      flush();
      current = { title: heading[2].trim(), level: heading[1].length, lines: [] };
    } else if (current) {
      current.lines.push(line);
    } else {
      preamble.push(line);
    }
  }
  flush();

  if (preamble.join("\n").trim()) {
    sections.unshift(
      ManuscriptImportSectionSchema.parse({
        id: crypto.randomUUID(),
        title: "Section provisoire",
        level: 1,
        ...extractAnnotations(preamble.join("\n")),
      })
    );
  }

  if (sections.length === 0) {
    sections.push(
      ManuscriptImportSectionSchema.parse({
        id: crypto.randomUUID(),
        title: "Section provisoire",
        level: 1,
        ...extractAnnotations(body),
      })
    );
  }

  return ManuscriptImportPreviewSchema.parse({ title, sections });
}

function readDocumentTitle(name: string, content: string): { title: string; body: string } {
  try {
    const { frontmatter, body } = parseFrontmatter(content.replace(/\r\n?/g, "\n"));
    return {
      title: typeof frontmatter.title === "string" ? frontmatter.title : titleFromName(name),
      body,
    };
  } catch {
    throw new Error("Le frontmatter Markdown est invalide.");
  }
}

function titleFromName(name: string): string {
  const basename = name.replace(/^.*[\\/]/, "").replace(/\.[^.]+$/, "").trim();
  return basename || "Manuscrit importé";
}

function extractAnnotations(content: string): Pick<ManuscriptImportSection, "content" | "annotations"> {
  const annotations: ManuscriptImportAnnotation[] = [];
  const lines: string[] = [];
  let fencedCode = false;
  let openComment = "";

  for (const line of content.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      fencedCode = !fencedCode;
      lines.push(line);
      continue;
    }
    if (fencedCode) {
      lines.push(line);
      continue;
    }

    const cleaned = extractComments(line, openComment);
    openComment = cleaned.openComment;
    annotations.push(...cleaned.comments);
    annotations.push(...findMarkdownLinks(cleaned.content));
    lines.push(cleaned.content);
  }

  if (openComment.trim()) annotations.push({ kind: "comment", content: openComment.trim() });

  return {
    content: trimSectionSeparators(lines.join("\n")),
    annotations,
  };
}

function extractComments(
  line: string,
  openComment: string
): { content: string; openComment: string; comments: ManuscriptImportAnnotation[] } {
  let content = "";
  let cursor = 0;
  let pending = openComment;
  const comments: ManuscriptImportAnnotation[] = [];

  while (cursor < line.length) {
    if (pending) {
      const end = line.indexOf("-->", cursor);
      if (end < 0) {
        return { content, openComment: `${pending}\n${line.slice(cursor)}`, comments };
      }
      pending = `${pending}\n${line.slice(cursor, end)}`;
      if (pending.trim()) comments.push({ kind: "comment", content: pending.trim() });
      pending = "";
      cursor = end + 3;
      continue;
    }

    const start = line.indexOf("<!--", cursor);
    if (start < 0) {
      content += line.slice(cursor);
      break;
    }
    content += line.slice(cursor, start);
    const end = line.indexOf("-->", start + 4);
    if (end < 0) return { content, openComment: line.slice(start + 4), comments };
    const comment = line.slice(start + 4, end).trim();
    if (comment) comments.push({ kind: "comment", content: comment });
    cursor = end + 3;
  }

  return { content, openComment: pending, comments };
}

function findMarkdownLinks(line: string): ManuscriptImportAnnotation[] {
  const annotations: ManuscriptImportAnnotation[] = [];
  let cursor = 0;
  let inlineCode = false;

  while (cursor < line.length) {
    if (line[cursor] === "`") {
      inlineCode = !inlineCode;
      cursor += 1;
      continue;
    }
    if (inlineCode || line[cursor] !== "[") {
      cursor += 1;
      continue;
    }

    const labelEnd = line.indexOf("](", cursor + 1);
    if (labelEnd < 0) break;
    const label = line.slice(cursor + 1, labelEnd).trim();
    const urlStart = labelEnd + 2;
    let depth = 1;
    let urlEnd = urlStart;
    while (urlEnd < line.length && depth > 0) {
      if (line[urlEnd] === "(") depth += 1;
      if (line[urlEnd] === ")") depth -= 1;
      urlEnd += 1;
    }
    if (depth !== 0) break;
    const url = line.slice(urlStart, urlEnd - 1).trim();
    if (label && /^https?:\/\/\S+$/.test(url)) annotations.push({ kind: "link", label, url });
    cursor = urlEnd;
  }

  return annotations;
}

function trimSectionSeparators(content: string): string {
  return content.replace(/^(?:[ \t]*\n)+/, "").replace(/(?:\n[ \t]*)+$/, "");
}
