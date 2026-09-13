import { describe, expect, it } from "vitest";
import type { Manuscript, Source } from "../src/domain";
import type { SourceProfile } from "../src/domain/sourceProfile";
import type { PlanningBrief } from "../src/domain/planningBrief";
import type { Citation } from "../src/domain/citation";
import type { EditorialPlan } from "../src/domain/editorialPlan";
import { createContentRelation } from "../src/domain/contentRelation";
import type {
  CorpusExplorer,
  RetrievedPassage,
} from "../src/bibliography/corpusExplorer";
import {
  collectDistributionNodes,
  distributeBibliography,
  distributeByKeywords,
  normalizeTerm,
  projectBibliography,
  projectEditorialPlanReferences,
  buildEvidencePackFromProjection,
} from "../src/bibliography/distribution";

const manuscript = {
  id: "m1",
  projectId: "p1",
  title: "Essai",
  tree: [
    {
      kind: "node" as const,
      id: "chap-1",
      title: "Chapitre 1 — Archive et diaspora",
      children: [],
    },
  ],
} as unknown as Manuscript;

const sources: Source[] = [
  { id: "src-1", type: "book", title: "Archive", authors: ["A"], content: "" },
  { id: "src-2", type: "book", title: "Contre-archive", authors: ["B"], content: "" },
];

const profiles: SourceProfile[] = [
  { sourceId: "src-1", subjects: ["diaspora"], concepts: ["archive"] },
  { sourceId: "src-2", subjects: ["archive"], concepts: ["contre-archive"] },
];

const brief: PlanningBrief = {
  id: "brief-1",
  projectId: "p1",
  scopeRef: {
    kind: "node",
    projectId: "p1",
    manuscriptId: "m1",
    nodeId: "chap-1",
  },
  version: 1,
  question: "Comment l'archive organise-t-elle la diaspora ?",
  hypotheses: [
    {
      statement: "L'archive stabilise la mémoire diasporique.",
      status: "emergent",
      sourceRefs: [],
    },
  ],
  gaps: [
    {
      description: "Manque un point de vue sur les archives sonores.",
      consequence: "Le chapitre reste centré sur l'écrit.",
      neededEvidence: "archive sonore diaspora",
    },
  ],
  constraints: [],
  sourceRefs: ["src-1"],
  createdAt: "2026-09-13T12:00:00.000Z",
  updatedAt: "2026-09-13T12:00:00.000Z",
};

const verifiedCitation: Citation = {
  id: "cit-1",
  projectId: "p1",
  sourceId: "src-1",
  quote: "Une archive stabilise certains récits.",
  locator: { kind: "page", value: "42" },
  verificationStatus: "verified",
  createdAt: "2026-09-13T12:00:00.000Z",
};

const contradiction = createContentRelation({
  id: "rel-1",
  scope: { level: "section", projectId: "p1", sectionId: "chap-1" },
  type: "contradicts",
  participants: [
    { kind: "source", id: "src-1" },
    { kind: "claim", id: "claim-1" },
  ],
  description: "La source contredit la stabilisation totale de la mémoire.",
  citationIds: ["cit-1"],
  origin: "co_constructed",
});

function passage(
  id: string,
  sourceId: string,
  probe: RetrievedPassage["probe"],
  text: string
): RetrievedPassage {
  return {
    id,
    sourceId,
    fingerprint: "a".repeat(64),
    span: { documentId: `doc-${sourceId}`, blockId: "b1", start: 0, end: text.length },
    locator: { kind: "page", value: sourceId === "src-1" ? "12" : "18" },
    text,
    mode: "corroboration",
    probe,
  };
}

describe("Corpus V2 documentary scope projection", () => {
  it("projects support, contradiction and qualification passages while preserving unresolved gaps", async () => {
    const explorer: CorpusExplorer = {
      retrieve: async (input) => {
        if (input.mode === "exploration") return [];
        return [
          passage("p-support", "src-1", "support", "Support exact."),
          passage("p-contradict", "src-2", "contradiction", "Contradiction exacte."),
          passage("p-qualify", "src-2", "qualification", "Qualification exacte."),
        ];
      },
    };

    const projected = await projectBibliography({
      planningBrief: brief,
      librarySources: sources,
      profiles,
      citations: [verifiedCitation],
      relations: [contradiction],
      explorer,
    });

    expect(projected.scopeId).toBe("chap-1");
    expect(projected.passages.map((item) => item.role)).toEqual([
      "supports",
      "contradicts",
      "qualifies",
    ]);
    expect(projected.passages.map((item) => item.passage.text)).toContain(
      "Contradiction exacte."
    );
    expect(projected.sources.map((source) => source.sourceId)).toEqual([
      "src-1",
      "src-2",
    ]);
    expect(projected.citationIds).toEqual(["cit-1"]);
    expect(projected.sourceRelationIds).toEqual(["rel-1"]);
    expect(projected.gaps).toEqual([
      "Manque un point de vue sur les archives sonores.",
    ]);
    expect(projected.unexploredAreas).toEqual(projected.gaps);
  });

  it("feeds canonical citation/relation refs to EditorialPlan and only projects them into EvidencePack", async () => {
    const projected = await projectBibliography({
      planningBrief: brief,
      librarySources: sources,
      profiles,
      citations: [verifiedCitation],
      relations: [contradiction],
    });
    const plan = {
      id: "ep-1",
      projectId: "p1",
      scope: { level: "section", projectId: "p1", sectionId: "chap-1" },
      claimIds: [],
      citationIds: [],
      sourceRelationIds: [],
      decisions: [],
      articulations: [],
      derivedFromRevisionIds: [],
      status: "draft",
      createdAt: "2026-09-13T12:00:00.000Z",
      updatedAt: "2026-09-13T12:00:00.000Z",
    } as unknown as EditorialPlan;

    const projectedPlan = projectEditorialPlanReferences(plan, projected);
    expect(projectedPlan.citationIds).toEqual(["cit-1"]);
    expect(projectedPlan.sourceRelationIds).toEqual(["rel-1"]);

    const evidencePack = buildEvidencePackFromProjection(
      projected,
      [verifiedCitation],
      [contradiction],
      ["claim-1"]
    );
    expect(evidencePack.keyCitations).toEqual([
      {
        sourceId: "src-1",
        quote: "Une archive stabilise certains récits.",
        pageRange: "42",
        context: undefined,
      },
    ]);
    expect(evidencePack.objections[0]).toMatchObject({
      statement: contradiction.description,
      sourceId: "src-1",
    });
    expect(evidencePack.supportingClaimIds).toEqual(["claim-1"]);
  });
});

describe("legacy keyword distribution fallback", () => {
  it("remains explicit compatibility behavior, not the Corpus V2 projection", async () => {
    expect(normalizeTerm(" Mémoire ")).toBe("memoire");
    const nodes = collectDistributionNodes(manuscript.tree);
    expect(distributeByKeywords(profiles[0], nodes)).toHaveLength(1);
    const entries = await distributeBibliography(manuscript, profiles);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ sourceId: "src-1", scopeId: "chap-1" });
  });
});
