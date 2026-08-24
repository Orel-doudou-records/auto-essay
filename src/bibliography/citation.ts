import type { Manuscript } from "../domain/index";
import type { Source } from "../domain/index";
import type { Citation, CitationUse } from "../domain/citation";
import type { BibliographyDistributionEntry } from "../domain/bibliographyDistribution";

/**
 * Le scope d'une unité rédigée : l'id du nœud dont une entrée de plan (E4,
 * `PlanEntry.unitId`) ou une feuille (T1, `leaf.unitId`) référence l'unité.
 * Pour une feuille, le scope est l'id du nœud parent.
 */
export function findUnitScope(
  manuscript: Manuscript,
  unitId: string
): string | undefined {
  const walk = (
    children: Manuscript["tree"],
    parentId: string | undefined
  ): string | undefined => {
    for (const child of children) {
      if (child.kind === "node") {
        const linked = (child.plan ?? []).some((e) => e.unitId === unitId);
        if (linked) return child.id;
        const deeper = walk(child.children, child.id);
        if (deeper) return deeper;
      } else if (child.unitId === unitId && parentId) {
        return parentId;
      }
    }
    return undefined;
  };
  return walk(manuscript.tree, undefined);
}

/** Les usages de citation d'une unité (via CitationUse.draftUnitId). */
export function citationsForUnit(
  unitId: string,
  citationUses: readonly CitationUse[]
): CitationUse[] {
  return citationUses.filter((use) => use.draftUnitId === unitId);
}

/**
 * Garde pure (F2) : toute citation utilisée par un paragraphe doit référencer
 * une source distribuée sur le scope de ce paragraphe. Sans scope résolu, rien
 * à vérifier (l'unité n'est pas encore rattachée au plan).
 */
export function assertCiteable(
  manuscript: Manuscript,
  unitId: string,
  distribution: readonly BibliographyDistributionEntry[],
  citationUses: readonly CitationUse[],
  citations: readonly Citation[]
): void {
  const scope = findUnitScope(manuscript, unitId);
  if (!scope) return;
  const allowed = new Set(
    distribution
      .filter((entry) => entry.scopeId === scope)
      .map((entry) => entry.sourceId)
  );
  for (const use of citationsForUnit(unitId, citationUses)) {
    const citation = citations.find((c) => c.id === use.citationId);
    if (!citation) {
      throw new Error(`Citation '${use.citationId}' not found`);
    }
    if (!allowed.has(citation.sourceId)) {
      throw new Error(
        `Citation '${citation.id}' uses source '${citation.sourceId}' not distributed on scope '${scope}'`
      );
    }
  }
}

/** Année d'une source (4 premiers caractères de publicationDate). */
export function sourceYear(source: Source): string {
  return source.publicationDate ? source.publicationDate.slice(0, 4) : "s.d.";
}

export type CitationStyle = "parenthetical" | "footnote";

/** Formateur de citation classique depuis une Source. */
export function formatCitation(
  source: Source,
  style: CitationStyle = "parenthetical"
): string {
  const authors =
    source.authors.length > 0 ? source.authors.join(" et ") : "Anon.";
  const year = sourceYear(source);
  if (style === "footnote") {
    const publisher = source.publisher ? `, ${source.publisher}` : "";
    return `${authors}, ${source.title}${publisher}, ${year}.`;
  }
  return `(${authors}, ${year})`;
}