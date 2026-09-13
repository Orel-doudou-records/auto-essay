import type { Manuscript } from "../domain/index";
import type { Source } from "../domain/index";
import {
  CitationSchema,
  type Citation,
  type CitationUse,
} from "../domain/citation";
import type { ContentRelation } from "../domain/contentRelation";
import type { RetrievedPassage } from "./corpusExplorer";
import type { ProjectedScope } from "./distribution";

/**
 * Promote a canonical RetrievedPassage into a Citation.
 * Retrieval does not imply verification: callers must provide the status.
 */
export function promoteRetrievedPassageToCitation(input: {
  projectId: string;
  passage: RetrievedPassage;
  verificationStatus: Citation["verificationStatus"];
  context?: string;
  citationId?: string;
  createdAt?: string;
}): Citation {
  const { passage } = input;
  return CitationSchema.parse({
    id: input.citationId ?? crypto.randomUUID(),
    projectId: input.projectId,
    sourceId: passage.sourceId,
    quote: passage.text,
    locator: passage.locator,
    context: input.context,
    retrievalProvenance: {
      retrievedPassageId: passage.id,
      documentId: passage.span.documentId,
      blockId: passage.span.blockId,
      start: passage.span.start,
      end: passage.span.end,
      documentFingerprint: passage.fingerprint,
    },
    verificationStatus: input.verificationStatus,
    createdAt: input.createdAt ?? new Date().toISOString(),
  });
}

/**
 * Cross-entity guard for functional evidence: every citation grounding a
 * relation must resolve and be explicitly verified.
 */
export function assertVerifiedRelationCitations(
  relation: ContentRelation,
  citations: readonly Citation[]
): void {
  const byId = new Map(citations.map((citation) => [citation.id, citation] as const));
  for (const citationId of relation.citationIds) {
    const citation = byId.get(citationId);
    if (!citation) {
      throw new Error(
        `ContentRelation '${relation.id}' references unknown citation '${citationId}'`
      );
    }
    if (citation.verificationStatus !== "verified") {
      throw new Error(
        `ContentRelation '${relation.id}' references non-verified citation '${citationId}'`
      );
    }
  }
}

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
 * Garde pure Corpus V2 : toute citation utilisée par un paragraphe doit être
 * autorisée par la projection documentaire de son scope. Sans scope résolu,
 * rien à vérifier (l'unité n'est pas encore rattachée au plan).
 */
export function assertCiteable(
  manuscript: Manuscript,
  unitId: string,
  projections: readonly ProjectedScope[],
  citationUses: readonly CitationUse[],
  citations: readonly Citation[]
): void {
  const scope = findUnitScope(manuscript, unitId);
  if (!scope) return;
  const projection = projections.find((item) => item.scopeId === scope);
  const allowedCitationIds = new Set(projection?.citationIds ?? []);
  const allowedSourceIds = new Set(projection?.sources.map((source) => source.sourceId) ?? []);

  for (const use of citationsForUnit(unitId, citationUses)) {
    const citation = citations.find((candidate) => candidate.id === use.citationId);
    if (!citation) {
      throw new Error(`Citation '${use.citationId}' not found`);
    }
    if (
      !allowedCitationIds.has(citation.id) &&
      !allowedSourceIds.has(citation.sourceId)
    ) {
      throw new Error(
        `Citation '${citation.id}' uses source '${citation.sourceId}' not projected on scope '${scope}'`
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
