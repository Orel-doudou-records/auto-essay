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

/** Normalise le XML ODT utile, sans jamais l'interpréter ni le rendre. */
export function previewOdtDocument(
  name: string,
  contentXml: string
): { preview: ManuscriptImportPreview; warnings: string[] } {
  const xml = normaliseNamespaces(contentXml);
  const annotations = new Map<string, ManuscriptImportAnnotation>();
  let annotationIndex = 0;
  const addAnnotation = (annotation: ManuscriptImportAnnotation): string => {
    const id = `annotation-${annotationIndex}`;
    annotationIndex += 1;
    annotations.set(id, annotation);
    return `<auto-essay-annotation data-id="${id}"/>`;
  };
  const withoutNestedAnnotations = xml
    .replace(/<text:note\b[^>]*>[\s\S]*?<\/text:note>/gi, (note) => {
      const content = noteContent(note);
      return content ? addAnnotation({ kind: "comment", content }) : "";
    })
    .replace(/<office:annotation\b[^>]*>[\s\S]*?<\/office:annotation>/gi, (annotation) => {
      const content = annotationContent(annotation);
      return content ? addAnnotation({ kind: "comment", content }) : "";
    });

  const sections: ConvertedSection[] = [];
  let current: ConvertedSection | undefined;
  let pendingAnnotations: ManuscriptImportAnnotation[] = [];
  for (const block of withoutNestedAnnotations.matchAll(/<text:(h|p)\b([^>]*)>([\s\S]*?)<\/text:\1>/gi)) {
    const tag = block[1].toLowerCase();
    const attributes = block[2];
    const inline = readInlineContent(block[3], annotations);
    if (tag === "h") {
      current = {
        title: inline.content || "Section provisoire",
        level: outlineLevel(attributes),
        paragraphs: [],
        annotations: [...pendingAnnotations, ...inline.annotations],
      };
      pendingAnnotations = [];
      sections.push(current);
      continue;
    }

    if (!inline.content && inline.annotations.length === 0) continue;
    if (!current) {
      current = { title: "Section provisoire", level: 1, paragraphs: [], annotations: pendingAnnotations };
      pendingAnnotations = [];
      sections.push(current);
    }
    current.annotations.push(...inline.annotations);
    if (inline.content) current.paragraphs.push(inline.content);
  }

  if (sections.length === 0) {
    throw new Error("Le document LibreOffice ne contient aucun titre ni paragraphe à importer.");
  }

  return {
    preview: ManuscriptImportPreviewSchema.parse({
      title: titleFromName(name),
      sections: sections.map((section): ManuscriptImportSection => ({
        id: crypto.randomUUID(),
        title: section.title,
        level: section.level,
        content: section.paragraphs.join("\n\n"),
        annotations: section.annotations,
      })),
    }),
    warnings: conversionWarnings(xml),
  };
}

function noteContent(note: string): string {
  const body = note.match(/<text:note-body\b[^>]*>([\s\S]*?)<\/text:note-body>/i)?.[1] ?? note;
  return xmlToText(body);
}

function annotationContent(annotation: string): string {
  return xmlToText(
    annotation
      .replace(/<dc:(creator|date)\b[^>]*>[\s\S]*?<\/dc:\1>/gi, "")
      .replace(/<office:annotation-end\b[^>]*\/>/gi, "")
  );
}

function readInlineContent(
  xml: string,
  annotations: Map<string, ManuscriptImportAnnotation>
): { content: string; annotations: ManuscriptImportAnnotation[] } {
  const found: ManuscriptImportAnnotation[] = [];
  const withoutLinks = xml.replace(/<text:a\b([^>]*)>([\s\S]*?)<\/text:a>/gi, (_match, attributes: string, labelXml: string) => {
    const label = xmlToText(labelXml);
    const url = readAttribute(attributes, "xlink:href");
    if (label && url && isHttpUrl(url)) found.push({ kind: "link", label, url });
    return label;
  });
  const withoutAnnotations = withoutLinks.replace(/<auto-essay-annotation\b([^>]*)\/>/gi, (_match, attributes: string) => {
    const annotation = annotations.get(readAttribute(attributes, "data-id") ?? "");
    if (annotation) found.push(annotation);
    return "";
  });
  return { content: xmlToText(withoutAnnotations), annotations: found };
}

function xmlToText(xml: string): string {
  return decodeEntities(
    xml
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
      .replace(/<text:line-break\b[^>]*\/?>(?:<\/text:line-break>)?/gi, "\n")
      .replace(/<text:tab\b[^>]*\/?>(?:<\/text:tab>)?/gi, "\t")
      .replace(/<text:s\b([^>]*)\/>/gi, (_match, attributes: string) => " ".repeat(spaceCount(attributes)))
      .replace(/<\/text:p>/gi, "\n")
      .replace(/<[^>]*>/g, "")
  )
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function spaceCount(attributes: string): number {
  const count = Number(readAttribute(attributes, "text:c") ?? "1");
  return Number.isInteger(count) && count > 0 ? Math.min(count, 100) : 1;
}

function outlineLevel(attributes: string): number {
  const level = Number(readAttribute(attributes, "text:outline-level") ?? "1");
  return Number.isInteger(level) && level >= 1 && level <= 6 ? level : 1;
}

function conversionWarnings(contentXml: string): string[] {
  const images = [...contentXml.matchAll(/<draw:image\b/gi)].length;
  return images > 0 ? [`${images} image${images > 1 ? "s" : ""} a été ignorée${images > 1 ? "s" : ""}.`] : [];
}


function normaliseNamespaces(xml: string): string {
  const knownNamespaces = {
    text: "urn:oasis:names:tc:opendocument:xmlns:text:1.0",
    office: "urn:oasis:names:tc:opendocument:xmlns:office:1.0",
    draw: "urn:oasis:names:tc:opendocument:xmlns:drawing:1.0",
    dc: "http://purl.org/dc/elements/1.1/",
    xlink: "http://www.w3.org/1999/xlink",
  };
  const scopes = [new Map<string, string>()];

  return xml.replace(/<[^>]+>/g, (tag) => {
    if (/^<\//.test(tag)) {
      const normalised = normaliseTagName(tag, scopes.at(-1)!, knownNamespaces);
      scopes.pop();
      return normalised;
    }
    if (/^<(!|\?)/.test(tag)) return tag;

    const namespaces = new Map(scopes.at(-1));
    for (const declaration of tag.matchAll(/\sxmlns(?::([\w.-]+))?\s*=\s*(["'])(.*?)\2/g)) {
      namespaces.set(declaration[1] ?? "", declaration[3]);
    }
    const normalised = normaliseAttributeNames(normaliseTagName(tag, namespaces, knownNamespaces), namespaces, knownNamespaces);
    if (!/\/>$/.test(tag)) scopes.push(namespaces);
    return normalised;
  });
}

function normaliseTagName(tag: string, namespaces: Map<string, string>, knownNamespaces: Record<string, string>): string {
  return tag.replace(/^(<\/?)([\w.-]+(?::[\w.-]+)?)/, (_match, opening: string, name: string) =>
    `${opening}${normaliseName(name, namespaces, knownNamespaces, true)}`
  );
}

function normaliseAttributeNames(
  tag: string,
  namespaces: Map<string, string>,
  knownNamespaces: Record<string, string>
): string {
  return tag.replace(/(\s)([\w.-]+(?::[\w.-]+)?)(?=\s*=)/g, (_match, leading: string, name: string) =>
    name === "xmlns" || name.startsWith("xmlns:")
      ? `${leading}${name}`
      : `${leading}${normaliseName(name, namespaces, knownNamespaces, false)}`
  );
}

function normaliseName(
  name: string,
  namespaces: Map<string, string>,
  knownNamespaces: Record<string, string>,
  useDefaultNamespace: boolean
): string {
  const [prefix, localName] = name.includes(":") ? name.split(":", 2) : ["", name];
  const namespace = namespaces.get(prefix);
  const canonical = Object.entries(knownNamespaces).find(([, value]) => value === namespace)?.[0];
  return canonical && (prefix || useDefaultNamespace) ? `${canonical}:${localName}` : name;
}
