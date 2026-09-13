import type { Citation, CitationLocator } from "../domain/citation";
import type { ContentRelation } from "../domain/contentRelation";
import type { EditorialPlan } from "../domain/editorialPlan";
import type { IngestedDocument, IngestedSpanRef } from "../domain/ingestedDocument";
import type { PlanningBrief } from "../domain/planningBrief";
import type { SourceProfile } from "../domain/sourceProfile";
import type { PlanningChangeImpact } from "../editorial/planningImpactReview";
import {
  assessComprehensionClosure,
  selectDocumentsNeedingProfiles,
} from "./bibliography";

export type DocumentChangeKind =
  | "added"
  | "removed"
  | "version_changed"
  | "unchanged";

export interface DocumentChange {
  sourceId: string;
  kind: DocumentChangeKind;
  previousFingerprint?: string;
  currentFingerprint?: string;
}

export type CitationRevalidationStatus =
  | "current"
  | "exact_match"
  | "relocated"
  | "ambiguous"
  | "missing"
  | "untracked"
  | "source_missing";

export interface CitationRevalidationCandidate {
  fingerprint: string;
  span: IngestedSpanRef;
  locator: CitationLocator;
}

export interface CitationRevalidation {
  citationId: string;
  sourceId: string;
  status: CitationRevalidationStatus;
  candidate?: CitationRevalidationCandidate;
}

export interface RelationInvalidation {
  relationId: string;
  status: "requires_revalidation" | "invalid";
  reason: string;
}

export interface CorpusInvalidationInput {
  previousDocuments: readonly IngestedDocument[];
  currentDocuments: readonly IngestedDocument[];
  profiles: readonly SourceProfile[];
  citations: readonly Citation[];
  relations: readonly ContentRelation[];
  planningBriefs?: readonly PlanningBrief[];
  editorialPlans?: readonly EditorialPlan[];
  explicitlyExcludedSourceIds?: readonly string[];
}

export interface CorpusInvalidationReport {
  documentChanges: DocumentChange[];
  profileSourceIdsToRebuild: string[];
  profileSourceIdsToDiscard: string[];
  citationReviews: CitationRevalidation[];
  relationReviews: RelationInvalidation[];
  impactedBriefIds: string[];
  impactedEditorialPlanIds: string[];
  planningImpacts: PlanningChangeImpact[];
  comprehensionClosure: ReturnType<typeof assessComprehensionClosure>;
}

/**
 * Pure, transient invalidation report. Direct references + fingerprints only:
 * no dependency graph, persistence, recursive propagation, or automatic rewrite.
 */
export function assessCorpusInvalidation(
  input: CorpusInvalidationInput
): CorpusInvalidationReport {
  const previousBySource = documentsBySource(input.previousDocuments);
  const currentBySource = documentsBySource(input.currentDocuments);
  const documentChanges = diffDocuments(previousBySource, currentBySource);

  const changedSourceIds = new Set(
    documentChanges
      .filter((change) => change.kind === "version_changed")
      .map((change) => change.sourceId)
  );
  const removedSourceIds = new Set(
    documentChanges
      .filter((change) => change.kind === "removed")
      .map((change) => change.sourceId)
  );
  const documentaryChangeSourceIds = new Set([
    ...changedSourceIds,
    ...removedSourceIds,
  ]);

  const profileSourceIdsToRebuild = selectDocumentsNeedingProfiles(
    [...input.currentDocuments],
    [...input.profiles]
  )
    .map((document) => document.sourceId)
    .sort();
  const profileSourceIdsToDiscard = input.profiles
    .filter((profile) => removedSourceIds.has(profile.sourceId))
    .map((profile) => profile.sourceId)
    .sort();

  const citationReviews = input.citations
    .filter((citation) => documentaryChangeSourceIds.has(citation.sourceId))
    .map((citation) =>
      assessCitationRevalidation(citation, currentBySource.get(citation.sourceId))
    )
    .sort((left, right) => left.citationId.localeCompare(right.citationId));
  const citationReviewById = new Map(
    citationReviews.map((review) => [review.citationId, review] as const)
  );

  const relationReviews = input.relations
    .map((relation) =>
      assessRelationInvalidation(
        relation,
        citationReviewById,
        changedSourceIds,
        removedSourceIds
      )
    )
    .filter((review): review is RelationInvalidation => Boolean(review))
    .sort((left, right) => left.relationId.localeCompare(right.relationId));
  const relationReviewIds = new Set(
    relationReviews.map((review) => review.relationId)
  );
  const reviewedCitationIds = new Set(citationReviews.map((review) => review.citationId));

  const planningBriefs = input.planningBriefs ?? [];
  const impactedBriefs = planningBriefs.filter((brief) =>
    brief.sourceRefs.some((sourceId) => documentaryChangeSourceIds.has(sourceId))
  );

  const editorialPlans = input.editorialPlans ?? [];
  const impactedPlans = editorialPlans.filter(
    (plan) =>
      plan.citationIds.some((citationId) => reviewedCitationIds.has(citationId)) ||
      plan.sourceRelationIds.some((relationId) => relationReviewIds.has(relationId))
  );

  const planningImpacts: PlanningChangeImpact[] = [
    ...impactedBriefs.map((brief) => ({
      scopeId: planningBriefScopeId(brief),
      kind: "source_gap_changed" as const,
      reason: "a documentary source referenced by this PlanningBrief changed or was removed",
      consequenceChain: [
        `PlanningBrief ${brief.id} references a changed or removed source`,
        "documentary assumptions require targeted revalidation",
        "do not rewrite the brief or manuscript automatically",
      ],
    })),
    ...impactedPlans.map((plan) => ({
      scopeId: editorialPlanScopeId(plan),
      kind: "editorial_plan_stale" as const,
      editorialPlanId: plan.id,
      reason: "a citation or content relation referenced by this EditorialPlan requires revalidation",
      consequenceChain: [
        `EditorialPlan ${plan.id} references changed documentary material`,
        "revalidate its citations/relations only",
        "do not regenerate the plan or rewrite text automatically",
      ],
    })),
  ];

  return {
    documentChanges,
    profileSourceIdsToRebuild,
    profileSourceIdsToDiscard,
    citationReviews,
    relationReviews,
    impactedBriefIds: impactedBriefs.map((brief) => brief.id).sort(),
    impactedEditorialPlanIds: impactedPlans.map((plan) => plan.id).sort(),
    planningImpacts,
    comprehensionClosure: assessComprehensionClosure(
      [...input.currentDocuments],
      [...input.profiles],
      [...(input.explicitlyExcludedSourceIds ?? [])]
    ),
  };
}

/**
 * Checks a citation against the current canonical document without mutating it.
 * A changed fingerprint is stale even when the quote can be found exactly.
 */
export function assessCitationRevalidation(
  citation: Citation,
  currentDocument: IngestedDocument | undefined
): CitationRevalidation {
  if (!currentDocument) {
    return {
      citationId: citation.id,
      sourceId: citation.sourceId,
      status: "source_missing",
    };
  }

  const provenance = citation.retrievalProvenance;
  if (!provenance) {
    return {
      citationId: citation.id,
      sourceId: citation.sourceId,
      status: "untracked",
    };
  }

  if (provenance.documentFingerprint === currentDocument.fingerprint) {
    return {
      citationId: citation.id,
      sourceId: citation.sourceId,
      status: "current",
    };
  }

  const sameBlock = currentDocument.blocks.find(
    (block) => block.id === provenance.blockId
  );
  if (
    sameBlock &&
    provenance.end <= sameBlock.text.length &&
    sameBlock.text.slice(provenance.start, provenance.end) === citation.quote
  ) {
    return {
      citationId: citation.id,
      sourceId: citation.sourceId,
      status: "exact_match",
      candidate: candidateFor(
        currentDocument,
        sameBlock.id,
        provenance.start,
        provenance.end,
        sameBlock.locator
      ),
    };
  }

  const matches: CitationRevalidationCandidate[] = [];
  for (const block of currentDocument.blocks) {
    let from = 0;
    while (from <= block.text.length - citation.quote.length) {
      const start = block.text.indexOf(citation.quote, from);
      if (start < 0) break;
      const end = start + citation.quote.length;
      matches.push(
        candidateFor(currentDocument, block.id, start, end, block.locator)
      );
      from = start + 1;
    }
  }

  if (matches.length === 1) {
    return {
      citationId: citation.id,
      sourceId: citation.sourceId,
      status: "relocated",
      candidate: matches[0],
    };
  }
  return {
    citationId: citation.id,
    sourceId: citation.sourceId,
    status: matches.length === 0 ? "missing" : "ambiguous",
  };
}

function assessRelationInvalidation(
  relation: ContentRelation,
  citationReviewById: ReadonlyMap<string, CitationRevalidation>,
  changedSourceIds: ReadonlySet<string>,
  removedSourceIds: ReadonlySet<string>
): RelationInvalidation | undefined {
  const participantSourceIds = relation.participants
    .filter((participant) => participant.kind === "source")
    .map((participant) => participant.id);
  const removedParticipant = participantSourceIds.find((sourceId) =>
    removedSourceIds.has(sourceId)
  );
  if (removedParticipant) {
    return {
      relationId: relation.id,
      status: "invalid",
      reason: `source '${removedParticipant}' was removed`,
    };
  }

  const reviewedCitations = relation.citationIds
    .map((citationId) => citationReviewById.get(citationId))
    .filter((review): review is CitationRevalidation => Boolean(review));
  const invalidCitation = reviewedCitations.find(
    (review) => review.status === "source_missing" || review.status === "missing"
  );
  if (invalidCitation) {
    return {
      relationId: relation.id,
      status: "invalid",
      reason: `citation '${invalidCitation.citationId}' no longer resolves to documentary material`,
    };
  }

  if (
    reviewedCitations.length > 0 ||
    participantSourceIds.some((sourceId) => changedSourceIds.has(sourceId))
  ) {
    return {
      relationId: relation.id,
      status: "requires_revalidation",
      reason: "a cited or participating source has a new documentary fingerprint",
    };
  }

  return undefined;
}

function diffDocuments(
  previousBySource: ReadonlyMap<string, IngestedDocument>,
  currentBySource: ReadonlyMap<string, IngestedDocument>
): DocumentChange[] {
  const sourceIds = [...new Set([...previousBySource.keys(), ...currentBySource.keys()])].sort();
  return sourceIds.map((sourceId) => {
    const previous = previousBySource.get(sourceId);
    const current = currentBySource.get(sourceId);
    if (!previous && current) {
      return {
        sourceId,
        kind: "added",
        currentFingerprint: current.fingerprint,
      };
    }
    if (previous && !current) {
      return {
        sourceId,
        kind: "removed",
        previousFingerprint: previous.fingerprint,
      };
    }
    if (!previous || !current) {
      throw new Error(`Cannot compare documentary source '${sourceId}'`);
    }
    return {
      sourceId,
      kind:
        previous.fingerprint === current.fingerprint
          ? "unchanged"
          : "version_changed",
      previousFingerprint: previous.fingerprint,
      currentFingerprint: current.fingerprint,
    };
  });
}

function documentsBySource(
  documents: readonly IngestedDocument[]
): Map<string, IngestedDocument> {
  const bySource = new Map<string, IngestedDocument>();
  for (const document of documents) {
    if (bySource.has(document.sourceId)) {
      throw new Error(
        `Multiple active documents found for source '${document.sourceId}'`
      );
    }
    bySource.set(document.sourceId, document);
  }
  return bySource;
}

function candidateFor(
  document: IngestedDocument,
  blockId: string,
  start: number,
  end: number,
  locator: CitationLocator
): CitationRevalidationCandidate {
  return {
    fingerprint: document.fingerprint,
    span: { documentId: document.id, blockId, start, end },
    locator,
  };
}

function planningBriefScopeId(brief: PlanningBrief): string {
  if (brief.scopeRef.kind === "node") return brief.scopeRef.nodeId;
  if (brief.scopeRef.kind === "plan_entry") return brief.scopeRef.planEntryId;
  return brief.scopeRef.manuscriptId;
}

function editorialPlanScopeId(plan: EditorialPlan): string {
  return plan.scope.paragraphId ?? plan.scope.sectionId ?? plan.scope.projectId;
}
