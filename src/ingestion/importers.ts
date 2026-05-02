import { createSource, type Source, type SourceType } from "../domain/source";

/**
 * Résultat d'importation
 */
export interface ImportResult {
  sources: Source[];
  errors: ImportError[];
}

export interface ImportError {
  file: string;
  line?: number;
  message: string;
}

/**
 * Frontmatter YAML extrait d'un fichier Markdown
 */
export interface MarkdownFrontmatter {
  title?: string;
  author?: string | string[];
  date?: string;
  tags?: string[];
  source?: string;
  doi?: string;
  url?: string;
  [key: string]: unknown;
}

/**
 * Parse le frontmatter YAML d'un fichier Markdown
 * Format: ---\nkey: value\n---
 */
export function parseFrontmatter(content: string): {
  frontmatter: MarkdownFrontmatter;
  body: string;
} {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const yamlContent = match[1];
  const body = match[2];

  // Parse YAML simple (key: value)
  const frontmatter: MarkdownFrontmatter = {};
  const lines = yamlContent.split("\n");

  for (const line of lines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    let value: unknown = line.slice(colonIndex + 1).trim();

    // Enlever les guillemets si présents
    if (
      typeof value === "string" &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }

    // Parser les tableaux simples [a, b, c]
    if (
      typeof value === "string" &&
      value.startsWith("[") &&
      value.endsWith("]")
    ) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((v) => v.trim().replace(/^["']|["']$/g, ""));
    }

    frontmatter[key] = value;
  }

  return { frontmatter, body };
}

/**
 * Extrait les annotations/citations du corps Markdown
 * Format: > citation (p. 12)
 */
export function extractCitations(content: string): Array<{
  quote: string;
  page?: string;
}> {
  const citations: Array<{ quote: string; page?: string }> = [];

  // Regex pour citations en bloc (> ...)
  const blockQuoteRegex = />\s*([^\n]+)(?:\n>\s*([^\n]+))*/g;
  const pageRegex = /\(p\.?\s*(\d+(?:-\d+)?)\)/i;

  let match;
  while ((match = blockQuoteRegex.exec(content)) !== null) {
    const quote = match[0]
      .replace(/^>\s?/gm, "")
      .replace(/\n/g, " ")
      .trim();

    const pageMatch = quote.match(pageRegex);
    citations.push({
      quote,
      page: pageMatch?.[1],
    });
  }

  return citations;
}

/**
 * Importe un fichier Markdown comme source
 */
export function importMarkdown(
  filePath: string,
  content: string,
  projectId: string
): Source {
  const { frontmatter, body } = parseFrontmatter(content);

  // Déterminer le type de source
  const type: SourceType = frontmatter.doi
    ? "article"
    : frontmatter.source?.includes(".pdf")
      ? "pdf"
      : "markdown";

  // Extraire les auteurs
  const authors: string[] = frontmatter.author
    ? Array.isArray(frontmatter.author)
      ? frontmatter.author
      : [frontmatter.author]
    : [];

  // Extraire les citations comme annotations
  const citations = extractCitations(body);
  const annotations = citations.map((c) => ({
    id: crypto.randomUUID(),
    sourceId: "", // Sera rempli après création
    content: c.quote,
    pageRange: c.page,
    createdAt: new Date().toISOString(),
  }));

  // Créer la source
  const source = createSource({
    projectId,
    type,
    title: frontmatter.title || filePath.split("/").pop() || "Sans titre",
    authors,
    content: body,
    url: frontmatter.url,
    doi: frontmatter.doi,
    publicationDate: frontmatter.date,
    tags: frontmatter.tags || [],
  });

  // Mettre à jour les IDs des annotations
  source.annotations = annotations.map((a) => ({
    ...a,
    sourceId: source.id,
    tags: [],
  }));

  return source;
}

/**
 * Importe plusieurs fichiers Markdown
 */
export function importMarkdownFiles(
  files: Array<{ path: string; content: string }>,
  projectId: string
): ImportResult {
  const sources: Source[] = [];
  const errors: ImportError[] = [];

  for (const file of files) {
    try {
      const source = importMarkdown(file.path, file.content, projectId);
      sources.push(source);
    } catch (error) {
      errors.push({
        file: file.path,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return { sources, errors };
}

/**
 * Parse un fichier BibTeX simple
 * Supporte les entrées @article, @book, @inproceedings
 */
export function parseBibTeX(content: string): Array<{
  type: string;
  key: string;
  fields: Record<string, string>;
}> {
  const entries: Array<{
    type: string;
    key: string;
    fields: Record<string, string>;
  }> = [];

  // Regex pour matcher une entrée BibTeX
  const entryRegex = /@(\w+)\s*\{\s*([^,]+),\s*([^}]+)\}/g;

  let match;
  while ((match = entryRegex.exec(content)) !== null) {
    const type = match[1].toLowerCase();
    const key = match[2].trim();
    const fieldsContent = match[3];

    // Parser les champs
    const fields: Record<string, string> = {};
    const fieldRegex = /(\w+)\s*=\s*\{([^}]+)\}/g;

    let fieldMatch;
    while ((fieldMatch = fieldRegex.exec(fieldsContent)) !== null) {
      const fieldName = fieldMatch[1].toLowerCase();
      let fieldValue = fieldMatch[2].trim();

      // Nettoyer les accolades imbriquées
      fieldValue = fieldValue.replace(/[{}]/g, "");

      fields[fieldName] = fieldValue;
    }

    entries.push({ type, key, fields });
  }

  return entries;
}

/**
 * Convertit une entrée BibTeX en Source
 */
export function bibEntryToSource(
  entry: {
    type: string;
    key: string;
    fields: Record<string, string>;
  },
  projectId: string
): Source {
  const authors = entry.fields.author
    ? entry.fields.author.split(" and ").map((a) => a.trim())
    : [];

  return createSource({
    projectId,
    type: entry.type === "book" ? "book" : "article",
    title: entry.fields.title || "Sans titre",
    authors,
    content: entry.fields.abstract || "",
    doi: entry.fields.doi,
    url: entry.fields.url,
    publicationDate: entry.fields.year,
    publisher: entry.fields.publisher || entry.fields.journal,
  });
}

/**
 * Importe un fichier BibTeX complet
 */
export function importBibTeX(
  content: string,
  projectId: string
): ImportResult {
  const sources: Source[] = [];
  const errors: ImportError[] = [];

  try {
    const entries = parseBibTeX(content);

    for (const entry of entries) {
      try {
        const source = bibEntryToSource(entry, projectId);
        sources.push(source);
      } catch (error) {
        errors.push({
          file: entry.key,
          message: error instanceof Error ? error.message : "Parse error",
        });
      }
    }
  } catch (error) {
    errors.push({
      file: "bibtex",
      message: error instanceof Error ? error.message : "Parse error",
    });
  }

  return { sources, errors };
}
