import type { Citation, DraftUnit, Manuscript, Source } from "../domain";

export interface ManuscriptExport {
  markdown: string;
  sources: Source[];
}

export function compileManuscript(
  manuscript: Manuscript,
  units: DraftUnit[],
  citations: Citation[],
  sources: Source[]
): ManuscriptExport {
  const compiledUnits = [...manuscript.units]
    .sort((left, right) => left.order - right.order)
    .map((reference) => {
      const unit = resolveUnit(manuscript, reference.unitId, reference.version, units);
      return unit;
    });
  const referencedSources: Source[] = [];
  const sourceIds = new Set<string>();

  for (const unit of compiledUnits) {
    for (const citationUse of unit.citationUses) {
      if (
        citationUse.draftUnitId !== unit.id ||
        citationUse.draftUnitVersion !== unit.version
      ) {
        throw new Error(
          `Citation use must target draft unit ${unit.id}@${unit.version}`
        );
      }
      validateCharacterRange(citationUse.characterRange, unit.content, citationUse.citationId);
      const citation = resolveProjectRecord(
        "Citation",
        citationUse.citationId,
        manuscript.projectId,
        citations
      );
      const source = resolveProjectRecord(
        "Source",
        citation.sourceId,
        manuscript.projectId,
        sources
      );

      if (!sourceIds.has(source.id)) {
        sourceIds.add(source.id);
        referencedSources.push(source);
      }
    }
  }

  const sections = [
    `# ${manuscript.title}`,
    ...compiledUnits.map((unit) => unit.content),
    "## Références",
  ];
  const references = referencedSources.map(formatApaReference).join("\n");

  return {
    markdown: `${sections.join("\n\n")}${references ? `\n\n${references}` : ""}`,
    sources: referencedSources,
  };
}

function resolveUnit(
  manuscript: Manuscript,
  unitId: string,
  version: number,
  units: DraftUnit[]
): DraftUnit {
  const matches = units.filter((unit) => unit.id === unitId && unit.version === version);
  const key = `${unitId}@${version}`;

  if (matches.length === 0) {
    throw new Error(`Draft unit ${key} is missing`);
  }
  if (matches.length > 1) {
    throw new Error(`Draft unit ${key} is ambiguous`);
  }
  if (matches[0].projectId !== manuscript.projectId) {
    throw new Error(`Draft unit ${key} belongs to another project`);
  }

  return matches[0];
}

function resolveProjectRecord<T extends { id: string; projectId: string }>(
  type: string,
  id: string,
  projectId: string,
  records: T[]
): T {
  const matches = records.filter((record) => record.id === id);

  if (matches.length === 0) {
    throw new Error(`${type} ${id} is missing`);
  }
  if (matches.length > 1) {
    throw new Error(`${type} ${id} is ambiguous`);
  }
  if (matches[0].projectId !== projectId) {
    throw new Error(`${type} ${id} belongs to another project`);
  }

  return matches[0];
}

function validateCharacterRange(
  characterRange: { start: number; end: number } | undefined,
  content: string,
  citationId: string
): void {
  if (
    characterRange &&
    (characterRange.start < 0 ||
      characterRange.end > content.length ||
      characterRange.start >= characterRange.end)
  ) {
    throw new Error(`Citation ${citationId} has an invalid character range`);
  }
}

function formatApaReference(source: Source): string {
  const date = source.publicationDate ?? "n.d.";
  const parts = source.authors.length > 0
    ? [`${formatAuthors(source.authors)} (${date}). ${source.title}.`]
    : [`${source.title}. (${date}).`];

  if (source.publisher) {
    parts.push(`${source.publisher}.`);
  }
  const doi = source.doi ? normalizeDoi(source.doi) : undefined;
  if (doi) {
    parts.push(`https://doi.org/${doi}`);
  } else if (source.url) {
    parts.push(source.url);
  }

  return parts.join(" ");
}

function formatAuthors(authors: string[]): string {
  const formatted = authors.map(formatAuthor);

  if (formatted.length === 1) {
    return formatted[0];
  }
  if (formatted.length === 2) {
    return `${formatted[0]}, & ${formatted[1]}`;
  }

  return `${formatted.slice(0, -1).join(", ")}, & ${formatted.at(-1)}`;
}

function formatAuthor(author: string): string {
  const trimmed = author.trim();

  if (trimmed.includes(",")) {
    return trimmed;
  }

  const names = trimmed.split(/\s+/);
  const surname = names.pop();
  const initials = names.map((name) => `${name[0]?.toUpperCase()}.`).join(" ");

  return initials ? `${surname}, ${initials}` : surname ?? "";
}

function normalizeDoi(doi: string): string | undefined {
  const suffix = doi
    .trim()
    .replace(/^doi:\s*/i, "")
    .replace(/^(?:https?:\/\/)?(?:dx\.)?doi\.org\//i, "")
    .replace(/\s+/g, "");

  return suffix || undefined;
}
