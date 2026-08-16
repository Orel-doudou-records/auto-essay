import { listUnits } from "./unitStore.js";
import { listSources } from "./sourceStore.js";
import type { Source } from "@auto-essay/core";

export async function exportMarkdown(
  projectId: string,
  unitIds?: string[]
): Promise<{ markdown: string; sourceIds: string[] }> {
  const units = await listUnits(projectId);
  const selected = unitIds?.length ? units.filter((u) => unitIds.includes(u.id)) : units;
  const sources = await listSources(projectId);

  const usedSourceIds = new Set<string>();
  const parts: string[] = [];

  for (const unit of selected) {
    if (unit.content) {
      parts.push(unit.content);
      parts.push("");
    }
    for (const id of unit.evidencePack.sourceIds) {
      usedSourceIds.add(id);
    }
  }

  const bibliography = sources
    .filter((s) => usedSourceIds.has(s.id))
    .map(formatSource)
    .filter(Boolean);

  if (bibliography.length > 0) {
    parts.push("## Bibliographie");
    parts.push("");
    parts.push(...bibliography);
  }

  return { markdown: parts.join("\n"), sourceIds: Array.from(usedSourceIds) };
}

function formatSource(source: Source): string {
  const authors = source.authors.join(", ") || "Auteur inconnu";
  const date = source.publicationDate ? ` (${source.publicationDate})` : "";
  return `- ${authors}${date}. _${source.title}_.${source.url ? ` ${source.url}` : ""}`;
}
