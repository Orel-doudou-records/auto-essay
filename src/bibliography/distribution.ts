import { z } from "zod";
import type { StructuredModelClient } from "../evaluation/evaluateEssay";
import type { Manuscript, Source } from "../domain/index";
import { collectNodeIds } from "../domain/manuscript";
import type { SourceProfile } from "../domain/sourceProfile";
import type { PlanningBrief } from "../domain/planningBrief";
import type { Citation } from "../domain/citation";
import type { ContentRelation } from "../domain/contentRelation";
import type { EditorialPlan } from "../domain/editorialPlan";
import type { EvidencePack } from "../domain/draftUnit";
import type {
  CorpusExplorer,
  RetrievedPassage,
  CorroborationProbe,
} from "./corpusExplorer";
import {
  BibliographyDistributionEntrySchema,
  type BibliographyDistributionEntry,
  type BibliographyDistributionEntryInput,
} from "../domain/bibliographyDistribution";

/** Nœud du manuscrit vu par le fallback historique de distribution. */
export interface DistributionNode {
  id: string;
  title: string;
  text?: string;
}

export interface DistributeOptions {
  /** Fallback assisté historique ; n'est plus l'autorité de projection Corpus V2. */
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

/** Normalisation minimale utilisée uniquement par le fallback historique. */
export function normalizeTerm(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** @deprecated Fallback metadata-only historique. Corpus V2 utilise projectBibliography(). */
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
        break;
      }
    }
  }
  return entries;
}

const AssistantDistributionSchema = z.object({
  entries: z.array(BibliographyDistributionEntrySchema).default([]),
});

/** @deprecated Prompt du fallback metadata-only historique. */
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

/** @deprecated Fallback historique. N'est plus le chemin cognitif principal. */
export async function distributeBibliography(
  manuscript: Manuscript,
  profiles: SourceProfile[],
  options: DistributeOptions = {}
): Promise<BibliographyDistributionEntry[]> {
  const nodes = collectDistributionNodes(manuscript.tree);
  if (options.client) {
    const raw = await options.client.generateJson(buildDistributePrompt(nodes, profiles));
    const parsed = AssistantDistributionSchema.parse(raw);
    const nodeIds = new Set(nodes.map((n) => n.id));
    const profileIds = new Set(profiles.map((p) => p.sourceId));
    return parsed.entries.filter(
      (entry) => nodeIds.has(entry.scopeId) && profileIds.has(entry.sourceId)
    );
  }
  const entries: BibliographyDistributionEntryInput[] = [];
  for (const profile of profiles) {
    entries.push(...distributeByKeywords(profile, nodes));
  }
  return entries.map((entry) => BibliographyDistributionEntrySchema.parse(entry));
}

/** @deprecated Validation du fallback historique source→scope. */
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

/** Source documentaire visible dans un scope, jamais le corpus intégral. */
export interface ProjectedSource {
  sourceId: string;
  title: string;
  authors: string[];
  subjects: string[];
  concepts: string[];
  abstract?: string;
}

export type DocumentaryRole = "supports" | "contradicts" | "qualifies" | "context";

export interface ProjectedPassage {
  passage: RetrievedPassage;
  role: DocumentaryRole;
  query: string;
}

/**
 * Projection transitoire et reconstruisible de la matière documentaire d'un scope.
 * Elle n'est ni un agrégat domaine ni une base canonique de preuves.
 */
export interface ProjectedScope {
  scopeId: string;
  sources: ProjectedSource[];
  passages: ProjectedPassage[];
  citationIds: string[];
  sourceRelationIds: string[];
  gaps: string[];
  unexploredAreas: string[];
}

export interface ProjectBibliographyInput {
  planningBrief: PlanningBrief;
  librarySources: readonly Source[];
  profiles: readonly SourceProfile[];
  citations?: readonly Citation[];
  relations?: readonly ContentRelation[];
  explorer?: CorpusExplorer;
  /** Contexte parent/voisins déjà résolu par l'appelant ; aucune lecture du manuscrit ici. */
  context?: readonly string[];
  limitPerProbe?: number;
}

/**
 * Shared point Corpus V2 : projette pour un scope les sources, passages,
 * citations/relations déjà qualifiées et lacunes restant ouvertes.
 *
 * Le retrieval peut être demandé ici, jamais dans Diffract. Les passages
 * retournés restent des candidats documentaires : seuls des Citation vérifiées
 * et ContentRelation qualifiées deviennent des références canoniques downstream.
 */
export async function projectBibliography(
  input: ProjectBibliographyInput
): Promise<ProjectedScope> {
  const {
    planningBrief,
    librarySources,
    profiles,
    citations = [],
    relations = [],
    explorer,
    context = [],
    limitPerProbe = 1,
  } = input;
  const scopeId = planningScopeId(planningBrief);
  const verifiedCitationById = new Map(
    citations
      .filter((citation) => citation.verificationStatus === "verified")
      .map((citation) => [citation.id, citation])
  );

  const relevantRelations = relations.filter((relation) => {
    if (!relationAppliesToScope(relation, planningBrief.projectId, scopeId)) return false;
    if (relation.citationIds.length === 0) return false;
    return relation.citationIds.every((citationId) => verifiedCitationById.has(citationId));
  });
  const citationIds = unique(
    relevantRelations.flatMap((relation) => relation.citationIds)
  );

  const passages: ProjectedPassage[] = [];
  const exploredGapIds = new Set<number>();
  if (explorer) {
    const sharedContext = [
      planningBrief.question,
      planningBrief.intention,
      planningBrief.angleOrFunction,
      ...context,
    ]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .join("\n");

    for (const hypothesis of planningBrief.hypotheses) {
      if (hypothesis.status === "rejected") continue;
      const query = [hypothesis.statement, sharedContext].filter(Boolean).join("\n");
      const probes: CorroborationProbe[] = [
        "support",
        "contradiction",
        "qualification",
      ];
      for (const probe of probes) {
        const retrieved = await explorer.retrieve({
          mode: "corroboration",
          query,
          probe,
          limit: limitPerProbe,
        });
        for (const passage of retrieved) {
          passages.push({
            passage,
            role: roleForProbe(passage.probe),
            query: hypothesis.statement,
          });
        }
      }
    }

    for (const [index, gap] of planningBrief.gaps.entries()) {
      const query = [gap.neededEvidence ?? gap.description, sharedContext]
        .filter(Boolean)
        .join("\n");
      const retrieved = await explorer.retrieve({
        mode: "exploration",
        query,
        limit: 1,
      });
      if (retrieved.length > 0) exploredGapIds.add(index);
      for (const passage of retrieved) {
        passages.push({ passage, role: "context", query: gap.description });
      }
    }
  }

  const dedupedPassages = dedupeProjectedPassages(passages);
  const projectedSourceIds = new Set<string>(planningBrief.sourceRefs);
  for (const citationId of citationIds) {
    const citation = verifiedCitationById.get(citationId);
    if (citation) projectedSourceIds.add(citation.sourceId);
  }
  for (const item of dedupedPassages) projectedSourceIds.add(item.passage.sourceId);
  for (const relation of relevantRelations) {
    for (const participant of relation.participants) {
      if (participant.kind === "source") projectedSourceIds.add(participant.id);
    }
  }

  const sourceById = new Map(librarySources.map((source) => [source.id, source]));
  const profileBySource = new Map(profiles.map((profile) => [profile.sourceId, profile]));
  const sources = [...projectedSourceIds]
    .map((sourceId) => projectSource(sourceId, sourceById.get(sourceId), profileBySource.get(sourceId)))
    .sort((left, right) => left.sourceId.localeCompare(right.sourceId));

  const gaps = planningBrief.gaps.map((gap) => gap.description);
  const unexploredAreas = planningBrief.gaps
    .filter((_, index) => !explorer || !exploredGapIds.has(index))
    .map((gap) => gap.description);

  return {
    scopeId,
    sources,
    passages: dedupedPassages,
    citationIds,
    sourceRelationIds: relevantRelations.map((relation) => relation.id),
    gaps,
    unexploredAreas,
  };
}

/** Ajoute uniquement les références canoniques de la projection à un plan existant. */
export function projectEditorialPlanReferences(
  plan: EditorialPlan,
  projection: ProjectedScope
): EditorialPlan {
  return {
    ...plan,
    citationIds: unique([...plan.citationIds, ...projection.citationIds]),
    sourceRelationIds: unique([
      ...plan.sourceRelationIds,
      ...projection.sourceRelationIds,
    ]),
  };
}

/**
 * Projection Writer : réutilise EvidencePack sans en faire une autorité.
 * Les relations contradictoires deviennent des objections ; leur traçabilité
 * canonique reste dans EditorialPlan.sourceRelationIds.
 */
export function buildEvidencePackFromProjection(
  projection: ProjectedScope,
  citations: readonly Citation[],
  relations: readonly ContentRelation[],
  supportingClaimIds: readonly string[] = []
): EvidencePack {
  const allowedCitationIds = new Set(projection.citationIds);
  const selectedCitations = citations.filter(
    (citation) =>
      allowedCitationIds.has(citation.id) && citation.verificationStatus === "verified"
  );
  const relationById = new Map(relations.map((relation) => [relation.id, relation]));
  const objections = projection.sourceRelationIds
    .map((relationId) => relationById.get(relationId))
    .filter((relation): relation is ContentRelation => relation?.type === "contradicts")
    .map((relation) => ({
      statement: relation.description,
      sourceId: relation.participants.find((participant) => participant.kind === "source")?.id,
    }));

  return {
    sourceIds: unique([
      ...projection.sources.map((source) => source.sourceId),
      ...selectedCitations.map((citation) => citation.sourceId),
    ]),
    keyCitations: selectedCitations.map((citation) => ({
      sourceId: citation.sourceId,
      quote: citation.quote,
      pageRange:
        citation.locator.kind === "page" ? citation.locator.value : undefined,
      context: citation.context,
    })),
    supportingClaimIds: [...supportingClaimIds],
    objections,
    authorNotes:
      projection.unexploredAreas.length > 0
        ? `Zones documentaires encore ouvertes : ${projection.unexploredAreas.join(" ; ")}`
        : undefined,
  };
}

function planningScopeId(brief: PlanningBrief): string {
  if (brief.scopeRef.kind === "node") return brief.scopeRef.nodeId;
  if (brief.scopeRef.kind === "plan_entry") return brief.scopeRef.planEntryId;
  return brief.scopeRef.manuscriptId;
}

function relationAppliesToScope(
  relation: ContentRelation,
  projectId: string,
  scopeId: string
): boolean {
  if (relation.scope.projectId !== projectId) return false;
  if (relation.scope.level === "project") return true;
  if (relation.scope.level === "section") return relation.scope.sectionId === scopeId;
  return relation.scope.paragraphId === scopeId || relation.scope.sectionId === scopeId;
}

function roleForProbe(probe: CorroborationProbe | undefined): DocumentaryRole {
  if (probe === "contradiction" || probe === "counterexample") return "contradicts";
  if (probe === "qualification" || probe === "alternative") return "qualifies";
  if (probe === "support") return "supports";
  return "context";
}

function projectSource(
  sourceId: string,
  source: Source | undefined,
  profile: SourceProfile | undefined
): ProjectedSource {
  return {
    sourceId,
    title: source?.title ?? sourceId,
    authors: source?.authors ?? [],
    subjects: profile?.subjects ?? [],
    concepts: profile?.concepts ?? [],
    abstract: profile?.abstract,
  };
}

function dedupeProjectedPassages(passages: ProjectedPassage[]): ProjectedPassage[] {
  const seen = new Set<string>();
  return passages.filter((item) => {
    const key = `${item.passage.id}:${item.role}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
