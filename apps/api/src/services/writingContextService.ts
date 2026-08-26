import {
  type BibliographyDistributionEntry,
  type EditorialDecision,
  type EvidencePack,
  type Source,
  type SourceProfile,
} from "@auto-essay/core";

export interface WritingEvidenceSource {
  sourceId: string;
  title: string;
  qualified: boolean;
  inclusion: "evidence_pack" | "visible_only";
  exclusionReason?: "missing_or_unqualified_profile" | "missing_excerpt";
  excerpt?: string;
  provenance: {
    distributionRationale?: string;
    distributionConfidence?: number;
    profile?: {
      subjects: string[];
      concepts: string[];
      abstract?: string;
    };
    pageRange?: string;
  };
}

export interface WritingContext {
  sectionId: string;
  decision: EditorialDecision;
  evidencePack: EvidencePack;
  visibleSources: WritingEvidenceSource[];
}

export function prepareWritingContext(input: {
  sectionId: string;
  decision: EditorialDecision;
  sources: Source[];
  profiles: SourceProfile[];
  distribution: BibliographyDistributionEntry[];
}): WritingContext {
  assertDecisionCanPrepareWriting(input.decision, input.sectionId);

  const sourceById = new Map(input.sources.map((source) => [source.id, source]));
  const profileBySourceId = new Map(input.profiles.map((profile) => [profile.sourceId, profile]));
  const visibleSources = uniqueDistributionForSection(input.distribution, input.sectionId)
    .map((entry) => toWritingEvidenceSource(entry, sourceById.get(entry.sourceId), profileBySourceId.get(entry.sourceId)))
    .filter((source): source is WritingEvidenceSource => source !== undefined);
  const qualifiedSources = visibleSources.filter((source) => source.inclusion === "evidence_pack");

  return {
    sectionId: input.sectionId,
    decision: input.decision,
    evidencePack: {
      sourceIds: qualifiedSources.map((source) => source.sourceId),
      keyCitations: qualifiedSources.map((source) => ({
        sourceId: source.sourceId,
        quote: source.excerpt ?? "",
        context: source.provenance.distributionRationale,
        pageRange: source.provenance.pageRange,
      })),
      supportingClaimIds: [],
      objections: [],
      authorNotes: undefined,
    },
    visibleSources,
  };
}

function assertDecisionCanPrepareWriting(decision: EditorialDecision, sectionId: string): void {
  if (decision.status !== "active") {
    throw new Error(`Decision ${decision.id} is not active`);
  }
  if (decision.scope.level === "section" && decision.scope.sectionId !== sectionId) {
    throw new Error(`Decision ${decision.id} belongs to another section`);
  }
  if (decision.scope.level === "paragraph") {
    throw new Error(`Paragraph decision ${decision.id} cannot prepare a section draft unit`);
  }
}

function uniqueDistributionForSection(
  distribution: BibliographyDistributionEntry[],
  sectionId: string
): BibliographyDistributionEntry[] {
  const bySourceId = new Map<string, BibliographyDistributionEntry>();
  for (const entry of distribution) {
    if (entry.scopeId === sectionId && !bySourceId.has(entry.sourceId)) {
      bySourceId.set(entry.sourceId, entry);
    }
  }
  return [...bySourceId.values()];
}

function toWritingEvidenceSource(
  distribution: BibliographyDistributionEntry,
  source: Source | undefined,
  profile: SourceProfile | undefined
): WritingEvidenceSource | undefined {
  if (!source) return undefined;
  const hasExcerpt = source.content.trim().length > 0;
  const hasQualifiedProfile = profile !== undefined && (
    profile.subjects.length > 0 ||
    profile.concepts.length > 0 ||
    Boolean(profile.abstract?.trim())
  );
  const qualified = hasQualifiedProfile && hasExcerpt;

  return {
    sourceId: source.id,
    title: source.title,
    qualified,
    inclusion: qualified ? "evidence_pack" : "visible_only",
    exclusionReason: qualified
      ? undefined
      : hasQualifiedProfile
        ? "missing_excerpt"
        : "missing_or_unqualified_profile",
    excerpt: hasExcerpt ? source.content.trim() : undefined,
    provenance: {
      distributionRationale: distribution.rationale,
      distributionConfidence: distribution.confidence,
      profile: profile
        ? { subjects: profile.subjects, concepts: profile.concepts, abstract: profile.abstract }
        : undefined,
      pageRange: source.pageRange,
    },
  };
}
