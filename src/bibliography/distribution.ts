import { z } from "zod";
import type { StructuredModelClient } from "../evaluation/evaluateEssay";
import type { Manuscript } from "../domain/index";
import { collectNodeIds } from "../domain/manuscript";
import type { Source } from "../domain/index";
import type { SourceProfile } from "../domain/sourceProfile";
import {
  BibliographyDistributionEntrySchema,
  type BibliographyDistributionEntry,
  type BibliographyDistributionEntryInput,
} from "../domain/bibliographyDistribution";

/** Nœud du manuscrit vu par la distribution (id + titre + texte). */
export interface DistributionNode {
  id: string;
  title: string;
  text?: string;
}

export interface DistributeOptions {
  /** Mode assisté : un appel structuré pour tout le manuscrit (sinon pur). */
  client?: StructuredModelClient;
}

export function collectDistributionNodes(tree: Manuscript["tree"]): DistributionNode[] {
  const nodes: DistributionNode[] = [];
  const walk = (children: Manuscript["tree"]): void => {
    for (const child of children) {
      if (child.kind === "node") {
        nodes.push({ id: child.id, title: child.title, text: child.text });
        walk(child.children);
      }
    }
  };
  walk(tree);
  return nodes;
}

/** Normalisation minimale d'un terme pour le matching pur. */
export function normalizeTerm(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Mode POUR (zéro token) : associe une source aux nœuds dont le titre ou le
 * texte contient un de ses sujets/concepts (normalisé, insensible à la casse
 * et aux accents).
 */
export function distributeByKeywords(
  profile: SourceProfile,
  nodes: DistributionNode[]
): BibliographyDistributionEntryInput[] {
  const terms = [...profile.subjects, ...profile.concepts].map(normalizeTerm).filter(Boolean);
  const entries: BibliographyDistributionEntryInput[] = [];
  for (const node of nodes) {
    const title = normalizeTerm(node.title);
    const text = normalizeTerm(node.text ?? "");
    for (const term of terms) {
      const matchTitle = term.length > 2 && title.includes(term);
      const matchText = term.length > 2 && text.includes(term);
      if (matchTitle || matchText) {
        entries.push({
          sourceId: profile.sourceId,
          scopeId: node.id,
          rationale: `mots-clés : « ${term} »${matchTitle ? " (titre)" : " (texte)"}`,
          confidence: matchTitle ? 1 : 0.6,
        });
        break; // un seul lien par source et par nœud
      }
    }
  }
  return entries;
}

const AssistantDistributionSchema = z.object({
  entries: z.array(BibliographyDistributionEntrySchema).default([]),
});

/**
 * Prompt du mode assisté : la liste compacte des nœuds (id + titre) et des
 * profils (id + sujets), jamais le corpus.
 */
export function buildDistributePrompt(
  nodes: DistributionNode[],
  profiles: SourceProfile[]
): string {
  const nodeRows = nodes.map((n) => `- ${n.id} | ${n.title}`).join("\n");
  const profileRows = profiles
    .map((p) => `- ${p.sourceId} | ${p.subjects.join(", ")}`)
    .join("\n");
  return `Associe chaque source au(x) chapitre(s)/paragraphe(s) du manuscrit qu'elle documente le mieux.
N'utilise que les ids fournis. Une source peut être associée à zéro, un ou plusieurs scopes.

## Scopes du manuscrit
${nodeRows}

## Sources (id | sujets)
${profileRows}

Réponds en JSON strict uniquement :
{"entries":[{"sourceId":"...","scopeId":"...","rationale":"pourquoi","confidence":0.8}]}`;
}

/**
 * Distribution : associe les profils du corpus aux scopes du manuscrit.
 * - Mode POUR (sans client) : `distributeByKeywords`, zéro token.
 * - Mode ASSISTÉ (avec client) : un appel structuré pour tout le manuscrit,
 *   ids inconnus filtrés (garde pure).
 */
export async function distributeBibliography(
  manuscript: Manuscript,
  profiles: SourceProfile[],
  options: DistributeOptions = {}
): Promise<BibliographyDistributionEntry[]> {
  const nodes = collectDistributionNodes(manuscript.tree);
  if (options.client) {
    const raw = await options.client.generateJson(
      buildDistributePrompt(nodes, profiles)
    );
    const parsed = AssistantDistributionSchema.parse(raw);
    const nodeIds = new Set(nodes.map((n) => n.id));
    const profileIds = new Set(profiles.map((p) => p.sourceId));
    return parsed.entries.filter(
      (e) => nodeIds.has(e.scopeId) && profileIds.has(e.sourceId)
    );
  }
  const entries: BibliographyDistributionEntryInput[] = [];
  for (const profile of profiles) {
    entries.push(...distributeByKeywords(profile, nodes));
  }
  return entries.map((e) => BibliographyDistributionEntrySchema.parse(e));
}

/** Refuse une distribution dont un scopeId n'existe pas dans l'arbre. */
export function assertDistributionValid(
  distribution: readonly BibliographyDistributionEntry[],
  manuscript: Manuscript
): void {
  const nodeIds = new Set(collectNodeIds(manuscript.tree));
  for (const entry of distribution) {
    if (!nodeIds.has(entry.scopeId)) {
      throw new Error(`Distribution scope '${entry.scopeId}' not found in manuscript`);
    }
  }
}

/** Source projetée dans un scope (ce que le lecteur voit, jamais le corpus). */
export interface ProjectedSource {
  sourceId: string;
  title: string;
  authors: string[];
  subjects: string[];
  concepts: string[];
  abstract?: string;
}

export interface ProjectedScope {
  scopeId: string;
  sources: ProjectedSource[];
}

/**
 * Projection : par scope, les sources pertinentes (avec leur profil). Les
 * sources sans profil sont projetées avec leurs métadonnées seules.
 */
export function projectBibliography(
  manuscript: Manuscript,
  distribution: readonly BibliographyDistributionEntry[],
  librarySources: readonly Source[],
  profiles: readonly SourceProfile[]
): ProjectedScope[] {
  const nodeIds = new Set(collectNodeIds(manuscript.tree));
  const sourceById = new Map(librarySources.map((s) => [s.id, s]));
  const profileBySource = new Map(profiles.map((p) => [p.sourceId, p]));

  const grouped = new Map<string, ProjectedSource[]>();
  for (const entry of distribution) {
    if (!nodeIds.has(entry.scopeId)) continue;
    const source = sourceById.get(entry.sourceId);
    const profile = profileBySource.get(entry.sourceId);
    const projected: ProjectedSource = {
      sourceId: entry.sourceId,
      title: source?.title ?? entry.sourceId,
      authors: source?.authors ?? [],
      subjects: profile?.subjects ?? [],
      concepts: profile?.concepts ?? [],
      abstract: profile?.abstract,
    };
    const list = grouped.get(entry.scopeId) ?? [];
    list.push(projected);
    grouped.set(entry.scopeId, list);
  }

  return [...grouped.entries()].map(([scopeId, sources]) => ({ scopeId, sources }));
}