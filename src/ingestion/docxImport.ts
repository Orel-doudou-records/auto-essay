import {
  ManuscriptImportPreviewSchema,
  type ManuscriptImportAnnotation,
  type ManuscriptImportPreview,
  type ManuscriptImportSection,
} from "./manuscriptImport";
import { decodeEntities, isHttpUrl, readAttribute, titleFromName } from "./documentImportHelpers";

type ConvertedSection = {
  title: string;
  level: number;
  paragraphs: string[];
  annotations: ManuscriptImportAnnotation[];
};

/**
 * Normalise le HTML produit par Mammoth, sans jamais le rendre. Seuls les
 * titres, paragraphes, liens HTTP(S) et notes Word connus rejoignent l'aperçu.
 */
export function previewDocxHtml(name: string, html: string): ManuscriptImportPreview {
  const annotationsById = readAnnotationDefinitions(html);
  const sections: ConvertedSection[] = [];
  let current: ConvertedSection | undefined;
  let pendingAnnotations: ManuscriptImportAnnotation[] = [];
  const referencedAnnotationIds = new Set<string>();
  const mainHtml = removeAnnotationLists(html);

  for (const block of mainHtml.matchAll(/<(h[1-6]|p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const tag = block[1].toLowerCase();
    const fragment = block[2];
    const referenced = readAnnotationReferences(fragment, annotationsById, referencedAnnotationIds);
    const inline = readInlineContent(fragment);

    if (tag.startsWith("h")) {
      current = {
        title: inline.content || "Section provisoire",
        level: Number(tag[1]),
        paragraphs: [],
        annotations: [...pendingAnnotations, ...inline.links, ...referenced],
      };
      pendingAnnotations = [];
      sections.push(current);
      continue;
    }

    if (!inline.content && referenced.length === 0 && inline.links.length === 0) continue;
    if (!current) {
      current = {
        title: "Section provisoire",
        level: 1,
        paragraphs: [],
        annotations: pendingAnnotations,
      };
      pendingAnnotations = [];
      sections.push(current);
    }
    current.annotations.push(...inline.links, ...referenced);
    if (inline.content) current.paragraphs.push(inline.content);
  }

  const unreferencedAnnotations = [...annotationsById.entries()]
    .filter(([id]) => !referencedAnnotationIds.has(id))
    .map(([, annotation]) => annotation);
  if (sections.length > 0) sections[0].annotations.push(...pendingAnnotations, ...unreferencedAnnotations);

  if (sections.length === 0) {
    throw new Error("Le document Word ne contient aucun titre ni paragraphe à importer.");
  }

  return ManuscriptImportPreviewSchema.parse({
    title: titleFromName(name),
    sections: sections.map((section): ManuscriptImportSection => ({
      id: crypto.randomUUID(),
      title: section.title,
      level: section.level,
      content: section.paragraphs.join("\n\n"),
      annotations: section.annotations,
    })),
  });
}

function readAnnotationDefinitions(html: string): Map<string, ManuscriptImportAnnotation> {
  const annotations = new Map<string, ManuscriptImportAnnotation>();

  for (const match of html.matchAll(/<dt\b([^>]*)>[\s\S]*?<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi)) {
    const id = readAttribute(match[1], "id");
    const content = readInlineContent(match[2]).content.replace(/\s*↑\s*$/u, "");
    if (id && isAnnotationId(id) && content) annotations.set(id, { kind: "comment", content });
  }

  for (const match of html.matchAll(/<li\b([^>]*)>([\s\S]*?)<\/li>/gi)) {
    const id = readAttribute(match[1], "id");
    const content = readInlineContent(match[2]).content.replace(/\s*↑\s*$/u, "");
    if (id && isAnnotationId(id) && content) annotations.set(id, { kind: "comment", content });
  }

  return annotations;
}

function removeAnnotationLists(html: string): string {
  return html.replace(/<(dl|ol)\b[^>]*>([\s\S]*?)<\/\1>/gi, (list, _tag, content: string) =>
    /<(?:dt|li)\b[^>]*\bid\s*=\s*["'][^"']*(?:comment|footnote|endnote)-\d+/i.test(content) ? "" : list
  );
}

function readAnnotationReferences(
  html: string,
  annotationsById: Map<string, ManuscriptImportAnnotation>,
  referencedAnnotationIds: Set<string>
): ManuscriptImportAnnotation[] {
  const annotations: ManuscriptImportAnnotation[] = [];
  for (const match of html.matchAll(/<a\b([^>]*)>[\s\S]*?<\/a>/gi)) {
    const href = readAttribute(match[1], "href");
    if (!href?.startsWith("#")) continue;
    const id = href.slice(1);
    const annotation = annotationsById.get(id);
    if (annotation) {
      referencedAnnotationIds.add(id);
      annotations.push(annotation);
    }
  }
  return annotations;
}

function readInlineContent(html: string): { content: string; links: ManuscriptImportAnnotation[] } {
  const links: ManuscriptImportAnnotation[] = [];
  const withoutAnchors = html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_match, attributes: string, labelHtml: string) => {
    const label = htmlToText(labelHtml);
    const href = readAttribute(attributes, "href");
    if (label && href && isHttpUrl(href)) {
      links.push({ kind: "link", label, url: href });
    }
    return href?.startsWith("#") && isAnnotationId(href.slice(1)) ? "" : label;
  });
  return { content: htmlToText(withoutAnchors), links };
}

function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
      .replace(/<br\b[^>]*>/gi, "\n")
      .replace(/<[^>]*>/g, "")
  )
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function isAnnotationId(id: string): boolean {
  return /(?:comment|footnote|endnote)-/i.test(id);
}
