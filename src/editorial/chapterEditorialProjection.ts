import type { BibliographyDistributionEntry } from "../domain/bibliographyDistribution";
import type { DraftUnit, DraftUnitStatus } from "../domain/draftUnit";
import type { EditorialDecision } from "../domain/editorialDecision";
import type { Manuscript, ManuscriptChild, ManuscriptNode } from "../domain/manuscript";
import { deriveNodeStatus } from "../domain/manuscriptStatus";
import type { Source } from "../domain/source";
import type { SourceProfile } from "../domain/sourceProfile";

export interface ChapterEditorialProjectionInput {
  chapterId: string;
  manuscript: Manuscript;
  units: DraftUnit[];
  decisions: EditorialDecision[];
  sources: Source[];
  profiles: SourceProfile[];
  distribution: BibliographyDistributionEntry[];
}

export interface ChapterEditorialProjection {
  chapter: {
    id: string;
    title: string;
    writingStatus: DraftUnitStatus;
  };
  sections: ChapterEditorialSection[];
}

export interface ChapterEditorialSection {
  id: string;
  title: string;
  order: number;
  writingStatus: DraftUnitStatus;
  decisions: ChapterDecisionReference[];
  units: ChapterUnitReference[];
  sources: ChapterSourceReference[];
}

export interface ChapterDecisionReference {
  id: string;
  contentCommitments: string[];
  formalCommitments: string[];
  provenance: {
    scope: string;
    articulationId: string;
    validatedBy: "author";
    validatedAt: string;
  };
}

export interface ChapterUnitReference {
  id: string;
  status: DraftUnitStatus;
  contentLength: number;
  provenance: {
    association: "manuscript_leaf" | "section_context";
  };
}

export interface ChapterSourceReference {
  sourceId: string;
  title: string;
  qualified: boolean;
  availability: "evidence_pack" | "visible_only";
  exclusionReason?: "missing_source" | "missing_or_unqualified_profile" | "missing_excerpt";
  provenance: {
    distributionScopeId: string;
    distributionRationale?: string;
    distributionConfidence?: number;
    profile?: {
      subjects: string[];
      concepts: string[];
      abstract?: string;
    };
  };
}

/**
 * Projection pure d'un chapitre pour l'atelier auteur. Elle décrit l'état
 * éditorial disponible et n'exécute aucune lecture, décision ou génération.
 */
export function projectChapterEditorialState(
  input: ChapterEditorialProjectionInput
): ChapterEditorialProjection {
  const chapter = findNode(input.manuscript.tree, input.chapterId);
  if (!chapter) {
    throw new Error(`chapter not found: ${input.chapterId}`);
  }

  const unitByReference = new Map(
    input.units.map((unit) => [`${unit.id}:${unit.version}`, unit])
  );
  const sourceById = new Map(input.sources.map((source) => [source.id, source]));
  const profileBySourceId = new Map(
    input.profiles.map((profile) => [profile.sourceId, profile])
  );
  const sections = chapter.children
    .filter((child): child is ManuscriptNode => child.kind === "node")
    .map((section, index) =>
      projectSection({
        section,
        order: index + 1,
        chapterId: chapter.id,
        unitByReference,
        units: input.units,
        decisions: input.decisions,
        distribution: input.distribution,
        sourceById,
        profileBySourceId,
      })
    );

  return {
    chapter: {
      id: chapter.id,
      title: chapter.title,
      writingStatus: nodeWritingStatus(chapter, unitByReference),
    },
    sections,
  };
}

function projectSection(input: {
  section: ManuscriptNode;
  order: number;
  chapterId: string;
  unitByReference: Map<string, DraftUnit>;
  units: DraftUnit[];
  decisions: EditorialDecision[];
  distribution: BibliographyDistributionEntry[];
  sourceById: Map<string, Source>;
  profileBySourceId: Map<string, SourceProfile>;
}): ChapterEditorialSection {
  const leafReferences = collectLeafReferences(input.section.children);
  const leafKeys = new Set(leafReferences.map((leaf) => `${leaf.unitId}:${leaf.version}`));
  const mountedUnits = leafReferences.flatMap((leaf) => {
    const unit = input.unitByReference.get(`${leaf.unitId}:${leaf.version}`);
    return unit ? [{ unit, association: "manuscript_leaf" as const }] : [];
  });
  const contextualUnits = input.units
    .filter(
      (unit) =>
        unit.contextInPlan?.section === input.section.id &&
        !leafKeys.has(`${unit.id}:${unit.version}`)
    )
    .map((unit) => ({ unit, association: "section_context" as const }));

  return {
    id: input.section.id,
    title: input.section.title,
    order: input.order,
    writingStatus: nodeWritingStatus(input.section, input.unitByReference),
    decisions: input.decisions
      .filter(
        (decision) =>
          decision.status === "active" &&
          appliesToSection(decision, input.section.id)
      )
      .map((decision) => ({
        id: decision.id,
        contentCommitments: decision.contentCommitments,
        formalCommitments: decision.formalCommitments,
        provenance: {
          scope: decision.scope.sectionId ?? "project",
          articulationId: decision.articulationId,
          validatedBy: decision.validation.validatedBy,
          validatedAt: decision.validation.validatedAt,
        },
      })),
    units: [...mountedUnits, ...contextualUnits].map(({ unit, association }) => ({
      id: unit.id,
      status: unit.status,
      contentLength: unit.content.length,
      provenance: { association },
    })),
    sources: uniqueDistributionForSection(input.distribution, input.section.id, input.chapterId)
      .map((entry) =>
        projectSource(
          entry,
          input.sourceById.get(entry.sourceId),
          input.profileBySourceId.get(entry.sourceId)
        )
      ),
  };
}

function appliesToSection(decision: EditorialDecision, sectionId: string): boolean {
  return (
    decision.scope.level === "project" ||
    decision.scope.sectionId === sectionId
  );
}

function nodeWritingStatus(
  node: ManuscriptNode,
  unitByReference: Map<string, DraftUnit>
): DraftUnitStatus {
  return deriveNodeStatus(node, (leaf) =>
    unitByReference.get(`${leaf.unitId}:${leaf.version}`)?.status ?? "drafting"
  );
}

function collectLeafReferences(children: ManuscriptChild[]) {
  const leaves: Array<Extract<ManuscriptChild, { kind: "leaf" }>> = [];
  for (const child of children) {
    if (child.kind === "leaf") {
      leaves.push(child);
    } else {
      leaves.push(...collectLeafReferences(child.children));
    }
  }
  return leaves;
}

function uniqueDistributionForSection(
  distribution: BibliographyDistributionEntry[],
  sectionId: string,
  chapterId: string
): BibliographyDistributionEntry[] {
  const bySourceId = new Map<string, BibliographyDistributionEntry>();
  for (const entry of distribution) {
    if (
      (entry.scopeId === sectionId || entry.scopeId === chapterId) &&
      !bySourceId.has(entry.sourceId)
    ) {
      bySourceId.set(entry.sourceId, entry);
    }
  }
  return [...bySourceId.values()];
}

function projectSource(
  distribution: BibliographyDistributionEntry,
  source: Source | undefined,
  profile: SourceProfile | undefined
): ChapterSourceReference {
  const hasQualifiedProfile = profile !== undefined && (
    profile.subjects.length > 0 ||
    profile.concepts.length > 0 ||
    Boolean(profile.abstract?.trim())
  );
  const hasExcerpt = Boolean(source?.content.trim());
  const qualified = source !== undefined && hasQualifiedProfile && hasExcerpt;

  return {
    sourceId: distribution.sourceId,
    title: source?.title ?? distribution.sourceId,
    qualified,
    availability: qualified ? "evidence_pack" : "visible_only",
    exclusionReason: qualified
      ? undefined
      : source === undefined
        ? "missing_source"
        : hasQualifiedProfile
          ? "missing_excerpt"
          : "missing_or_unqualified_profile",
    provenance: {
      distributionScopeId: distribution.scopeId,
      distributionRationale: distribution.rationale,
      distributionConfidence: distribution.confidence,
      profile: profile
        ? {
            subjects: profile.subjects,
            concepts: profile.concepts,
            abstract: profile.abstract,
          }
        : undefined,
    },
  };
}

function findNode(children: ManuscriptChild[], id: string): ManuscriptNode | undefined {
  for (const child of children) {
    if (child.kind !== "node") continue;
    if (child.id === id) return child;
    const nested = findNode(child.children, id);
    if (nested) return nested;
  }
  return undefined;
}
