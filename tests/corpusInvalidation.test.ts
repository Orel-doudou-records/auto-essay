import { describe, expect, it } from "vitest";
import type { Citation } from "../src/domain/citation";
import type { ContentRelation } from "../src/domain/contentRelation";
import type { EditorialPlan } from "../src/domain/editorialPlan";
import type { IngestedDocument } from "../src/domain/ingestedDocument";
import type { PlanningBrief } from "../src/domain/planningBrief";
import type { SourceProfile } from "../src/domain/sourceProfile";
import {
  assessCitationRevalidation,
  assessCorpusInvalidation,
} from "../src/bibliography/invalidation";

const OLD = "a".repeat(64);
const NEW = "b".repeat(64);
const SAME = "c".repeat(64);
const ADDED = "d".repeat(64);

function document(
  sourceId: string,
  fingerprint: string,
  blocks: Array<{ id: string; text: string; page: string }>
): IngestedDocument {
  return {
    id: `doc-${sourceId}-${fingerprint.slice(0, 4)}`,
    sourceId,
    fingerprint,
    ingestionStatus: "ready",
    diagnostics: [],
    blocks: blocks.map((block, index) => ({
      id: block.id,
      kind: "page",
      order: index,
      text: block.text,
      sectionPath: [],
      locator: { kind: "page", value: block.page },
    })),
  };
}

function profile(sourceId: string, fingerprint: string, blockIds: string[]): SourceProfile {
  return {
    sourceId,
    fingerprint,
    subjects: [],
    concepts: [],
    sections: blockIds.map((blockId) => ({
      sectionPath: [],
      synopsis: `synopsis ${blockId}`,
      blockIds: [blockId],
    })),
    comprehension: {
      totalBlocks: blockIds.length,
      coveredBlockIds: blockIds,
      excludedBlockIds: [],
      status: "ready",
    },
  };
}

function citation(
  id: string,
  sourceId: string,
  fingerprint: string,
  blockId: string,
  quote: string,
  start = 0
): Citation {
  return {
    id,
    projectId: "p1",
    sourceId,
    quote,
    locator: { kind: "page", value: "1" },
    retrievalProvenance: {
      retrievedPassageId: `passage-${id}`,
      documentId: `old-doc-${sourceId}`,
      blockId,
      start,
      end: start + quote.length,
      documentFingerprint: fingerprint,
    },
    verificationStatus: "verified",
    createdAt: "2026-09-13T12:00:00.000Z",
  };
}

function relation(id: string, sourceId: string, citationId: string): ContentRelation {
  return {
    id,
    scope: { level: "section", projectId: "p1", sectionId: "section-1" },
    type: "supports",
    participants: [
      { kind: "source", id: sourceId },
      { kind: "claim", id: "claim-1" },
    ],
    description: "relation",
    citationIds: [citationId],
    confidence: "high",
    origin: "co_constructed",
    status: "active",
    createdAt: "2026-09-13T12:00:00.000Z",
  };
}

const plan = {
  id: "plan-a",
  citationIds: ["cit-a"],
  sourceRelationIds: ["rel-a"],
  scope: { level: "section", projectId: "p1", sectionId: "section-1" },
} as unknown as EditorialPlan;

const brief = {
  id: "brief-a",
  projectId: "p1",
  scopeRef: {
    kind: "node",
    projectId: "p1",
    manuscriptId: "m1",
    nodeId: "section-1",
  },
  sourceRefs: ["source-a"],
} as unknown as PlanningBrief;

describe("targeted corpus invalidation", () => {
  it("changes A without invalidating independent source B", () => {
    const previousA = document("source-a", OLD, [
      { id: "a1", text: "Stable quotation.", page: "1" },
    ]);
    const currentA = document("source-a", NEW, [
      { id: "a1", text: "Stable quotation.", page: "1" },
    ]);
    const previousB = document("source-b", SAME, [
      { id: "b1", text: "Independent material.", page: "2" },
    ]);
    const currentB = document("source-b", SAME, [
      { id: "b1", text: "Independent material.", page: "2" },
    ]);
    const citA = citation("cit-a", "source-a", OLD, "a1", "Stable quotation.");
    const citB = citation("cit-b", "source-b", SAME, "b1", "Independent material.");

    const report = assessCorpusInvalidation({
      previousDocuments: [previousA, previousB],
      currentDocuments: [currentA, currentB],
      profiles: [
        profile("source-a", OLD, ["a1"]),
        profile("source-b", SAME, ["b1"]),
      ],
      citations: [citA, citB],
      relations: [relation("rel-a", "source-a", "cit-a")],
      planningBriefs: [brief],
      editorialPlans: [plan],
    });

    expect(report.documentChanges).toEqual([
      expect.objectContaining({ sourceId: "source-a", kind: "version_changed" }),
      expect.objectContaining({ sourceId: "source-b", kind: "unchanged" }),
    ]);
    expect(report.profileSourceIdsToRebuild).toEqual(["source-a"]);
    expect(report.citationReviews).toEqual([
      expect.objectContaining({ citationId: "cit-a", status: "exact_match" }),
    ]);
    expect(report.relationReviews).toEqual([
      expect.objectContaining({ relationId: "rel-a", status: "requires_revalidation" }),
    ]);
    expect(report.impactedBriefIds).toEqual(["brief-a"]);
    expect(report.impactedEditorialPlanIds).toEqual(["plan-a"]);
    expect(report.comprehensionClosure.blockingSourceIds).toEqual(["source-a"]);
    expect(report.comprehensionClosure.readySourceIds).toEqual(["source-b"]);
    expect(report.citationReviews.some((review) => review.citationId === "cit-b")).toBe(false);
  });

  it("distinguishes relocated, missing and ambiguous quotes without mutating citations", () => {
    const moved = citation("cit-moved", "source-a", OLD, "old", "Needle");
    const missing = citation("cit-missing", "source-a", OLD, "old", "Gone");
    const ambiguous = citation("cit-ambiguous", "source-a", OLD, "old", "Twice");
    const current = document("source-a", NEW, [
      { id: "new-1", text: "Prefix Needle suffix. Twice.", page: "3" },
      { id: "new-2", text: "Twice.", page: "4" },
    ]);

    expect(assessCitationRevalidation(moved, current)).toMatchObject({
      status: "relocated",
      candidate: { span: { blockId: "new-1", start: 7, end: 13 } },
    });
    expect(assessCitationRevalidation(missing, current).status).toBe("missing");
    expect(assessCitationRevalidation(ambiguous, current).status).toBe("ambiguous");
    expect(moved.retrievalProvenance?.documentFingerprint).toBe(OLD);
  });

  it("marks a relation invalid when its source is removed", () => {
    const oldDocument = document("source-a", OLD, [
      { id: "a1", text: "Quoted.", page: "1" },
    ]);
    const citA = citation("cit-a", "source-a", OLD, "a1", "Quoted.");

    const report = assessCorpusInvalidation({
      previousDocuments: [oldDocument],
      currentDocuments: [],
      profiles: [profile("source-a", OLD, ["a1"])],
      citations: [citA],
      relations: [relation("rel-a", "source-a", "cit-a")],
      editorialPlans: [plan],
    });

    expect(report.profileSourceIdsToDiscard).toEqual(["source-a"]);
    expect(report.citationReviews[0].status).toBe("source_missing");
    expect(report.relationReviews).toEqual([
      expect.objectContaining({ relationId: "rel-a", status: "invalid" }),
    ]);
    expect(report.impactedEditorialPlanIds).toEqual(["plan-a"]);
  });

  it("blocks corpus-first closure when a new source has not been comprehended", () => {
    const stable = document("source-b", SAME, [
      { id: "b1", text: "Stable.", page: "1" },
    ]);
    const added = document("source-c", ADDED, [
      { id: "c1", text: "New source.", page: "1" },
    ]);

    const report = assessCorpusInvalidation({
      previousDocuments: [stable],
      currentDocuments: [stable, added],
      profiles: [profile("source-b", SAME, ["b1"])],
      citations: [],
      relations: [],
    });

    expect(report.documentChanges).toContainEqual(
      expect.objectContaining({ sourceId: "source-c", kind: "added" })
    );
    expect(report.profileSourceIdsToRebuild).toEqual(["source-c"]);
    expect(report.comprehensionClosure.complete).toBe(false);
    expect(report.comprehensionClosure.blockingSourceIds).toEqual(["source-c"]);
  });
});
