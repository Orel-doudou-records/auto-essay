import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createSource, type Source } from "../src/domain/source.js";
import type { IngestedDocument } from "../src/domain/ingestedDocument.js";
import type { Manuscript } from "../src/domain/manuscript.js";
import type { PlanningBrief } from "../src/domain/planningBrief.js";
import type { EditorialPlan } from "../src/domain/editorialPlan.js";
import { createDraftUnit } from "../src/domain/draftUnit.js";
import { createContentRelation } from "../src/domain/contentRelation.js";
import { importMarkdownDocument } from "../src/ingestion/documentIngestion.js";
import { importPdfDocument } from "../src/ingestion/pdfDocumentIngestion.js";
import {
  assessComprehensionClosure,
  buildProfiles,
} from "../src/bibliography/bibliography.js";
import {
  createCorpusExplorer,
  type CorpusLocator,
} from "../src/bibliography/corpusExplorer.js";
import {
  proposePlanningSubjectsFromClosedCorpus,
  createPlanningBriefFromSubject,
} from "../src/editorial/planningSubjects.js";
import { promoteRetrievedPassageToCitation } from "../src/bibliography/citation.js";
import {
  buildEvidencePackFromProjection,
  projectBibliography,
  projectEditorialPlanReferences,
} from "../src/bibliography/distribution.js";
import { assessCorpusInvalidation } from "../src/bibliography/invalidation.js";
import { ParagraphGenerator } from "../src/pipeline/paragraphMode.js";
import {
  EssayEvaluator,
  type StructuredModelClient,
} from "../src/evaluation/evaluateEssay.js";

const temporaryDirectories: string[] = [];
const PDF_FIXTURE_BASE64 =
  "JVBERi0xLjQKJUF1dG9Fc3NheQoxIDAgb2JqCjw8IC9UeXBlIC9DYXRhbG9nIC9QYWdlcyAyIDAgUiA+PgplbmRvYmoKMiAwIG9iago8PCAvVHlwZSAvUGFnZXMgL0tpZHMgWzMgMCBSXSAvQ291bnQgMSA+PgplbmRvYmoKMyAwIG9iago8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDIgMCBSIC9NZWRpYUJveCBbMCAwIDYxMiA3OTJdIC9SZXNvdXJjZXMgPDwgL0ZvbnQgPDwgL0YxIDUgMCBSID4+ID4+IC9Db250ZW50cyA0IDAgUiA+PgplbmRvYmoKNCAwIG9iago8PCAvTGVuZ3RoIDExMiA+PgpzdHJlYW0KQlQKL0YxIDEyIFRmCjcyIDcyMCBUZAooVGhlIFBERiBzb3VyY2UgcmVqZWN0cyBhIHN0YWJsZSBjYXRlZ29yeSBhbmQgc3VwcGxpZXMgYSBzaW5ndWxhciBjb3VudGVyZXhhbXBsZS4pIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKNSAwIG9iago8PCAvVHlwZSAvRm9udCAvU3VidHlwZSAvVHlwZTEgL0Jhc2VGb250IC9IZWx2ZXRpY2EgPj4KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAyMCAwMDAwMCBuIAowMDAwMDAwMDY5IDAwMDAwIG4gCjAwMDAwMDAxMjYgMDAwMDAgbiAKMDAwMDAwMDI1MiAwMDAwMCBuIAowMDAwMDAwNDE0IDAwMDAwIG4gCnRyYWlsZXIKPDwgL1NpemUgNiAvUm9vdCAxIDAgUiA+PgpzdGFydHhyZWYKNDg0CiUlRU9GCg==";

class ProfileClient implements StructuredModelClient {
  async generateJson(prompt: string): Promise<unknown> {
    if (prompt.startsWith("Résume uniquement")) {
      return { synopsis: "La source décrit une catégorie historique et conserve sa tension documentaire." };
    }
    if (prompt.startsWith("Fusionne les synopsis")) {
      return { synopsis: "La source conserve les tensions entre catégorisation et contestation." };
    }
    if (prompt.startsWith("Construis le profil sémantique")) {
      return {
        subjects: ["catégorisation historique"],
        concepts: ["catégorie", "contestation"],
        abstract: "Une source située sur la fabrication ou la contestation d'une catégorie.",
      };
    }
    throw new Error(`Unexpected profile prompt: ${prompt.slice(0, 80)}`);
  }
}

class ClosedCorpusClient implements StructuredModelClient {
  constructor(private readonly documents: IngestedDocument[]) {}

  async generateJson(prompt: string): Promise<unknown> {
    const [first, second] = this.documents;
    if (!first || !second) throw new Error("ClosedCorpusClient requires two documents");

    if (prompt.startsWith("Compare l'ensemble FERME")) {
      return {
        observations: [
          {
            id: "obs-contradiction",
            kind: "contradiction",
            statement: "Une source stabilise la catégorie tandis que l'autre la conteste.",
            sourceIds: [first.sourceId, second.sourceId],
            anchors: [
              { sourceId: first.sourceId, blockId: first.blocks[0]!.id },
              { sourceId: second.sourceId, blockId: second.blocks[0]!.id },
            ],
          },
        ],
      };
    }

    if (prompt.startsWith("Tu aides un auteur")) {
      const passageId = (document: IngestedDocument): string => {
        const block = document.blocks[0]!;
        return `${document.id}:${document.fingerprint.slice(0, 16)}:${block.id}:0-${block.text.length}`;
      };
      return {
        axes: [
          {
            label: "Historicité et contestation",
            question: "Comment une catégorie se stabilise-t-elle puis se défait-elle ?",
            rationale: "Le corpus met en tension deux régimes documentaires.",
            evidence: [
              { passageId: passageId(first), role: "supports" },
              { passageId: passageId(second), role: "contests" },
            ],
            limits: [],
          },
        ],
        subjects: [
          {
            title: "La catégorie instable",
            question: "Comment écrire l'histoire d'une catégorie que les sources ne stabilisent pas ?",
            angle: "Faire de la contradiction documentaire le moteur du livre.",
            hypotheses: ["La stabilité de la catégorie dépend du régime documentaire."],
            distinctiveness: "Le sujet naît du désaccord du corpus plutôt que d'une thèse préalable.",
            evidence: [
              { passageId: passageId(first), role: "supports" },
              { passageId: passageId(second), role: "contests" },
            ],
            limits: [],
          },
          {
            title: "Le contre-exemple comme méthode",
            question: "Que change une source singulière dans l'organisation d'un corpus ?",
            angle: "Prendre la singularité comme contrainte de planification.",
            hypotheses: ["Une singularité peut déplacer un sujet malgré sa faible fréquence."],
            distinctiveness: "Le corpus n'est pas réduit à ses récurrences.",
            evidence: [{ passageId: passageId(second), role: "supports" }],
            limits: [],
          },
        ],
      };
    }

    throw new Error(`Unexpected closed-corpus prompt: ${prompt.slice(0, 80)}`);
  }
}

class SingleOutputClient implements StructuredModelClient {
  prompts: string[] = [];
  constructor(private readonly output: unknown) {}

  async generateJson(prompt: string): Promise<unknown> {
    this.prompts.push(prompt);
    return this.output;
  }
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  );
});

async function temporaryPdf(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "auto-essay-corpus-v2-"));
  temporaryDirectories.push(directory);
  const path = join(directory, "counterexample.pdf");
  await writeFile(path, Buffer.from(PDF_FIXTURE_BASE64, "base64"));
  return path;
}

function canonicalDocument(
  id: string,
  sourceId: string,
  fingerprintCharacter: string,
  text: string,
  page: string
): IngestedDocument {
  return {
    id,
    sourceId,
    fingerprint: fingerprintCharacter.repeat(64),
    ingestionStatus: "ready",
    diagnostics: [],
    blocks: [
      {
        id: `${id}:block-1`,
        kind: "paragraph",
        order: 0,
        text,
        sectionPath: [],
        locator: { kind: "page", value: page },
      },
    ],
  };
}

function source(projectId: string, title: string, text: string): Source {
  return createSource({
    projectId,
    type: "note",
    title,
    authors: [title],
    content: text,
  });
}

function baseEditorialPlan(projectId: string, sectionId: string): EditorialPlan {
  const now = new Date().toISOString();
  return {
    id: "editorial-plan-1",
    projectId,
    scope: { level: "section", projectId, sectionId },
    claimIds: [],
    citationIds: [],
    sourceRelationIds: [],
    decisions: [],
    articulations: [],
    derivedFromRevisionIds: [],
    status: "draft",
    createdAt: now,
    updatedAt: now,
  } as unknown as EditorialPlan;
}

function judgeOutput() {
  return {
    overallScore: 8.2,
    dimensions: {
      claimSupport: 8,
      citationIntegrity: 9,
      counterargumentQuality: 8,
      transitionClarity: 8,
      scopeControl: 8,
      voiceConsistency: 8,
    },
    weaknesses: [],
    strongClaims: ["Les sources restent attribuées séparément."],
    weakClaims: [],
    aiPatternsDetected: [],
    overclaimRisks: [],
    top3Revisions: [],
    newClaimEntries: [],
    evidenceGaps: [],
    citationGaps: [],
    verdict: "keep",
  };
}

describe("Corpus V2 end-to-end locks", () => {
  it("starts from Markdown + PDF only, closes comprehension, discovers a subject, then creates PlanningBrief", async () => {
    const projectId = "project-corpus-first";
    const markdown = importMarkdownDocument(
      "archive.md",
      `---\ntitle: Archive historique\nauthor: Archiviste\n---\n# Catégorie\nThe archive stabilises a category through repeated administrative descriptions.`,
      projectId
    );
    const pdfSource = source(projectId, "Contre-exemple PDF", "");
    const pdfDocument = await importPdfDocument(await temporaryPdf(), pdfSource.id);
    const documents = [markdown.document, pdfDocument];

    const profiles = await buildProfiles(documents, new ProfileClient());
    const closure = assessComprehensionClosure(documents, profiles);
    expect(closure.complete).toBe(true);
    expect(closure.readySourceIds.sort()).toEqual(
      documents.map((document) => document.sourceId).sort()
    );

    // No Manuscript exists before corpus comparison and subject discovery.
    const discovery = await proposePlanningSubjectsFromClosedCorpus(
      { documents, profiles },
      new ClosedCorpusClient(documents)
    );
    expect(discovery.retrievalCoverage.complete).toBe(true);
    expect(discovery.planning.subjects[0]?.title).toBe("La catégorie instable");
    expect(discovery.planning.subjects[0]?.status).toBe("contested");

    const manuscript = {
      id: "manuscript-after-discovery",
      projectId,
      title: "Livre découvert depuis le corpus",
      tree: [],
    } as Manuscript;
    const brief = createPlanningBriefFromSubject({
      manuscript,
      scopeRef: {
        kind: "manuscript",
        projectId,
        manuscriptId: manuscript.id,
      },
      subject: discovery.planning.subjects[0]!,
    });

    expect(brief.question).toContain("Comment écrire l'histoire");
    expect(brief.sourceRefs.sort()).toEqual(
      documents.map((document) => document.sourceId).sort()
    );
  });

  it("carries contradictory retrieval through verified citations/relations, scope projection, Writer and Judge", async () => {
    const projectId = "project-scope";
    const sectionId = "section-1";
    const sourceA = source(
      projectId,
      "Archive A",
      "The institutional archive stabilises the category but records only one regime."
    );
    const sourceB = source(
      projectId,
      "Archive B",
      "A witness rejects that stable category and supplies a counterexample."
    );
    const docA = canonicalDocument(
      "doc-a",
      sourceA.id,
      "a",
      sourceA.content,
      "12"
    );
    const docB = canonicalDocument(
      "doc-b",
      sourceB.id,
      "b",
      sourceB.content,
      "18"
    );
    const locator: CorpusLocator = async (input) => {
      const target = input.probe === "support" ? docA : docB;
      return [
        {
          documentId: target.id,
          blockId: target.blocks[0]!.id,
          reason: `e2e-${input.probe ?? "exploration"}`,
        },
      ];
    };
    const explorer = createCorpusExplorer([docA, docB], locator);
    const [supportPassage] = await explorer.retrieve({
      mode: "corroboration",
      probe: "support",
      query: "category stability",
      limit: 1,
    });
    const [contradictionPassage] = await explorer.retrieve({
      mode: "corroboration",
      probe: "contradiction",
      query: "category stability",
      limit: 1,
    });

    const supportCitation = promoteRetrievedPassageToCitation({
      projectId,
      passage: supportPassage!,
      verificationStatus: "verified",
      citationId: "citation-support",
    });
    const contradictionCitation = promoteRetrievedPassageToCitation({
      projectId,
      passage: contradictionPassage!,
      verificationStatus: "verified",
      citationId: "citation-contradiction",
    });
    const supportRelation = createContentRelation({
      id: "relation-support",
      scope: { level: "section", projectId, sectionId },
      type: "supports",
      participants: [
        { kind: "source", id: sourceA.id },
        { kind: "claim", id: "claim-category" },
      ],
      description: "Archive A soutient la stabilité documentaire de la catégorie.",
      citationIds: [supportCitation.id],
      origin: "co_constructed",
    });
    const contradictionRelation = createContentRelation({
      id: "relation-contradiction",
      scope: { level: "section", projectId, sectionId },
      type: "contradicts",
      participants: [
        { kind: "source", id: sourceB.id },
        { kind: "claim", id: "claim-category" },
      ],
      description: "Archive B contredit une stabilité générale de la catégorie.",
      citationIds: [contradictionCitation.id],
      origin: "co_constructed",
    });
    const brief: PlanningBrief = {
      id: "brief-scope",
      projectId,
      scopeRef: {
        kind: "node",
        projectId,
        manuscriptId: "manuscript-scope",
        nodeId: sectionId,
      },
      version: 1,
      question: "La catégorie est-elle stable ?",
      hypotheses: [
        {
          statement: "La catégorie semble stable dans les archives institutionnelles.",
          status: "contested",
          sourceRefs: [sourceA.id, sourceB.id],
        },
      ],
      gaps: [],
      constraints: [],
      sourceRefs: [sourceA.id, sourceB.id],
      createdAt: "2026-09-13T12:00:00.000Z",
      updatedAt: "2026-09-13T12:00:00.000Z",
    };
    const projection = await projectBibliography({
      planningBrief: brief,
      librarySources: [sourceA, sourceB],
      profiles: [],
      citations: [supportCitation, contradictionCitation],
      relations: [supportRelation, contradictionRelation],
      explorer,
    });
    expect(projection.passages.map((item) => item.role)).toEqual([
      "supports",
      "contradicts",
      "qualifies",
    ]);
    expect(projection.citationIds.sort()).toEqual([
      supportCitation.id,
      contradictionCitation.id,
    ].sort());

    const plan = projectEditorialPlanReferences(
      baseEditorialPlan(projectId, sectionId),
      projection
    );
    const evidencePack = buildEvidencePackFromProjection(
      projection,
      [supportCitation, contradictionCitation],
      [supportRelation, contradictionRelation],
      ["claim-category"]
    );
    expect(plan.sourceRelationIds.sort()).toEqual([
      supportRelation.id,
      contradictionRelation.id,
    ].sort());
    expect(evidencePack.keyCitations).toHaveLength(2);
    expect(evidencePack.objections).toHaveLength(1);

    const writerClient = new SingleOutputClient({
      plan_3_sentences: ["Attribuer les deux sources", "Maintenir la contradiction"],
      paragraph:
        "Archive A présente la catégorie comme stable dans son propre régime documentaire. Archive B fournit pourtant un contre-exemple qui refuse cette stabilité. Les deux formulations restent attribuées à leurs sources respectives ; le désaccord devient donc une limite explicite plutôt qu'une synthèse inventée. Le corpus suggère ainsi que la stabilité observée dépend du type d'archive mobilisé, sans autoriser une conclusion générale au-delà des passages vérifiés.",
      claims: [
        {
          statement: "Les deux sources attribuent différemment la stabilité de la catégorie.",
          confidenceLevel: "probable",
          sourceIds: [sourceA.id, sourceB.id],
        },
      ],
      confidence_assessment: "medium",
      applied_directives: [],
    });
    const generated = await new ParagraphGenerator(writerClient).generateParagraph(
      evidencePack,
      [sourceA, sourceB],
      { thesis: "Maintenir la contradiction documentaire" }
    );
    const unit = createDraftUnit({
      projectId,
      granularity: "paragraph",
      thesis: "Maintenir la contradiction documentaire",
      evidencePack,
      content: generated.content,
    });
    const judgeClient = new SingleOutputClient(judgeOutput());
    const evaluation = await new EssayEvaluator(judgeClient).evaluate({
      unit,
      sources: [sourceA, sourceB],
      claims: [],
    });

    expect(writerClient.prompts[0]).toContain("Citations clés à intégrer");
    expect(judgeClient.prompts[0]).toContain("Sources utilisées");
    expect(evaluation.verdict).toBe("keep");
    expect(evaluation.dimensions.citationIntegrity).toBe(9);
  });

  it("targets invalidation to one changed source and never rewrites manuscript, brief or plan", () => {
    const projectId = "project-invalidation";
    const sourceA = source(projectId, "Source A", "Version one quote remains important.");
    const sourceB = source(projectId, "Source B", "Independent documentary material.");
    const previousA = canonicalDocument("doc-a", sourceA.id, "a", sourceA.content, "1");
    const currentA = canonicalDocument(
      "doc-a-v2",
      sourceA.id,
      "c",
      "Version two relocates the quote. Version one quote remains important.",
      "2"
    );
    const documentB = canonicalDocument("doc-b", sourceB.id, "b", sourceB.content, "1");
    const citationA = promoteRetrievedPassageToCitation({
      projectId,
      passage: {
        id: "passage-a-v1",
        sourceId: sourceA.id,
        fingerprint: previousA.fingerprint,
        span: {
          documentId: previousA.id,
          blockId: previousA.blocks[0]!.id,
          start: 0,
          end: sourceA.content.length,
        },
        locator: previousA.blocks[0]!.locator,
        text: sourceA.content,
        mode: "exploration",
      },
      verificationStatus: "verified",
      citationId: "citation-a",
    });
    const citationB = promoteRetrievedPassageToCitation({
      projectId,
      passage: {
        id: "passage-b",
        sourceId: sourceB.id,
        fingerprint: documentB.fingerprint,
        span: {
          documentId: documentB.id,
          blockId: documentB.blocks[0]!.id,
          start: 0,
          end: sourceB.content.length,
        },
        locator: documentB.blocks[0]!.locator,
        text: sourceB.content,
        mode: "exploration",
      },
      verificationStatus: "verified",
      citationId: "citation-b",
    });
    const relationA = createContentRelation({
      id: "relation-a",
      scope: { level: "section", projectId, sectionId: "section-a" },
      type: "supports",
      participants: [
        { kind: "source", id: sourceA.id },
        { kind: "claim", id: "claim-a" },
      ],
      description: "Source A soutient claim A.",
      citationIds: [citationA.id],
      origin: "co_constructed",
    });
    const relationB = createContentRelation({
      id: "relation-b",
      scope: { level: "section", projectId, sectionId: "section-b" },
      type: "supports",
      participants: [
        { kind: "source", id: sourceB.id },
        { kind: "claim", id: "claim-b" },
      ],
      description: "Source B soutient claim B.",
      citationIds: [citationB.id],
      origin: "co_constructed",
    });
    const manuscript = {
      id: "manuscript-stable",
      projectId,
      title: "Stable",
      tree: [],
    } as Manuscript;
    const brief: PlanningBrief = {
      id: "brief-a",
      projectId,
      scopeRef: { kind: "manuscript", projectId, manuscriptId: manuscript.id },
      version: 1,
      question: "Question stable",
      hypotheses: [],
      gaps: [],
      constraints: [],
      sourceRefs: [sourceA.id],
      createdAt: "2026-09-13T12:00:00.000Z",
      updatedAt: "2026-09-13T12:00:00.000Z",
    };
    const planA = {
      ...baseEditorialPlan(projectId, "section-a"),
      id: "plan-a",
      citationIds: [citationA.id],
      sourceRelationIds: [relationA.id],
    };
    const planB = {
      ...baseEditorialPlan(projectId, "section-b"),
      id: "plan-b",
      citationIds: [citationB.id],
      sourceRelationIds: [relationB.id],
    };
    const before = JSON.stringify({ manuscript, brief, planA, planB });

    const report = assessCorpusInvalidation({
      previousDocuments: [previousA, documentB],
      currentDocuments: [currentA, documentB],
      profiles: [],
      citations: [citationA, citationB],
      relations: [relationA, relationB],
      planningBriefs: [brief],
      editorialPlans: [planA, planB],
    });

    expect(report.documentChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceId: sourceA.id, kind: "version_changed" }),
        expect.objectContaining({ sourceId: sourceB.id, kind: "unchanged" }),
      ])
    );
    expect(report.citationReviews.map((review) => review.citationId)).toEqual([
      citationA.id,
    ]);
    expect(report.relationReviews.map((review) => review.relationId)).toEqual([
      relationA.id,
    ]);
    expect(report.impactedEditorialPlanIds).toEqual([planA.id]);
    expect(report.impactedEditorialPlanIds).not.toContain(planB.id);
    expect(JSON.stringify({ manuscript, brief, planA, planB })).toBe(before);
  });

  it("keeps forbidden parallel authorities out of the runtime", () => {
    expect(existsSync("src/bibliography/graphify.ts")).toBe(false);
    expect(existsSync("src/domain/evidence.ts")).toBe(false);
    expect(existsSync("src/domain/documentMap.ts")).toBe(false);
    expect(existsSync("src/domain/corpusMap.ts")).toBe(false);

    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect(packageJson.dependencies?.pageindex).toBeUndefined();
    expect(packageJson.devDependencies?.pageindex).toBeUndefined();

    const distribution = readFileSync("src/bibliography/distribution.ts", "utf8");
    expect(distribution).not.toContain("distributeByKeywords");
    expect(distribution).not.toContain("buildDistributePrompt");
    expect(distribution).not.toContain("StructuredModelClient");
  });
});
