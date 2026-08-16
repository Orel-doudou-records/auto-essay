import { describe, expect, it } from "vitest";
import { createSource } from "../src/domain/source";
import { WriterEditorialProjectionSchema } from "../src/domain/editorialProjection";
import type { EvidencePack } from "../src/domain/draftUnit";
import { ParagraphGenerator } from "../src/pipeline/paragraphMode";

class MockClient {
  prompts: string[] = [];

  constructor(private readonly output: unknown) {}

  async generateJson(prompt: string): Promise<unknown> {
    this.prompts.push(prompt);
    return this.output;
  }
}

function source() {
  return createSource({
    projectId: "project-1",
    title: "Archive",
    content: "Contenu",
    type: "pdf",
  });
}

function evidencePack(sourceId: string): EvidencePack {
  return {
    sourceIds: [sourceId],
    keyCitations: [],
    supportingClaimIds: ["claim-1"],
    objections: [],
  };
}

function projection(sourceId: string) {
  const now = new Date().toISOString();

  return WriterEditorialProjectionSchema.parse({
    id: "projection-1",
    type: "writer",
    planId: "plan-1",
    unitId: "unit-1",
    unitVersion: 1,
    scope: {
      level: "paragraph",
      projectId: "project-1",
      sectionId: "section-1",
      paragraphId: "paragraph-1",
    },
    decisionIds: ["decision-1"],
    articulationIds: ["articulation-1"],
    createdAt: now,
    argumentativeFunction: "exposer une contradiction",
    allowedClaimIds: ["claim-1"],
    allowedEvidenceIds: [sourceId],
    allowedSourceRelationIds: ["relation-1"],
    directives: [
      {
        id: "directive-1",
        decisionId: "decision-1",
        articulationId: "articulation-1",
        kind: "form",
        instruction: "attribuer chaque version",
      },
    ],
    intendedEffects: {
      content: ["maintenir les versions distinctes"],
      form: ["séparer les voix documentaires"],
    },
  });
}

describe("ParagraphGenerator editorial mode", () => {
  it("preserves historical generation without editorial traces", async () => {
    const inputSource = source();
    const client = new MockClient({
      plan_3_sentences: ["Présenter la source"],
      paragraph: "Le document situe l'événement sans permettre de conclure davantage.",
      claims: [
        {
          statement: "Le document situe l'événement.",
          confidenceLevel: "probable",
          sourceIds: [inputSource.id],
        },
      ],
      confidence_assessment: "medium",
    });

    const result = await new ParagraphGenerator(client).generateParagraph(
      evidencePack(inputSource.id),
      [inputSource]
    );

    expect(result.transformationTraces).toEqual([]);
    expect(result.appliedDecisionIds).toEqual([]);
  });

  it("creates grounded traces from declared editorial applications", async () => {
    const inputSource = source();
    const editorialProjection = projection(inputSource.id);
    const excerpt = "Chaque archive nomme pourtant une chronologie différente.";
    const client = new MockClient({
      plan_3_sentences: ["Maintenir les versions distinctes"],
      paragraph: `${excerpt} Cette divergence reste attribuée à chaque document.`,
      claims: [
        {
          statement: "Les archives proposent des chronologies différentes.",
          confidenceLevel: "probable",
          sourceIds: [inputSource.id],
        },
      ],
      confidence_assessment: "medium",
      applied_directives: [
        {
          directiveId: "directive-1",
          decisionId: "decision-1",
          articulationId: "articulation-1",
          declaration: "Séparation explicite des voix documentaires",
          excerpt,
        },
      ],
    });

    const result = await new ParagraphGenerator(client).generateParagraph(
      evidencePack(inputSource.id),
      [inputSource],
      {
        unitId: "unit-1",
        unitVersion: 1,
        editorialProjection,
      }
    );

    expect(result.transformationTraces).toHaveLength(1);
    expect(result.transformationTraces[0]).toEqual(
      expect.objectContaining({
        projectionId: editorialProjection.id,
        directiveId: "directive-1",
        decisionId: "decision-1",
        articulationId: "articulation-1",
        status: "declared",
      })
    );
    expect(result.appliedDecisionIds).toEqual(["decision-1"]);
    expect(client.prompts[0]).toContain("Plan éditorial validé");
  });

  it("rejects an invented directive identifier", async () => {
    const inputSource = source();
    const client = new MockClient({
      plan_3_sentences: [],
      paragraph: "Un extrait exact apparaît ici.",
      claims: [],
      confidence_assessment: "low",
      applied_directives: [
        {
          directiveId: "invented-directive",
          decisionId: "decision-1",
          articulationId: "articulation-1",
          declaration: "Déclaration inventée",
          excerpt: "extrait exact",
        },
      ],
    });

    await expect(
      new ParagraphGenerator(client).generateParagraph(
        evidencePack(inputSource.id),
        [inputSource],
        {
          unitId: "unit-1",
          unitVersion: 1,
          editorialProjection: projection(inputSource.id),
        }
      )
    ).rejects.toThrow("unknown directive invented-directive");
  });

  it("rejects editorial generation without unitId and unitVersion", async () => {
    const inputSource = source();
    const client = new MockClient({
      plan_3_sentences: ["Maintenir les versions distinctes"],
      paragraph: "Paragraphe.",
      claims: [],
      confidence_assessment: "medium",
      applied_directives: [],
    });

    await expect(
      new ParagraphGenerator(client).generateParagraph(
        evidencePack(inputSource.id),
        [inputSource],
        {
          editorialProjection: projection(inputSource.id),
        }
      )
    ).rejects.toThrow("Editorial paragraph generation requires unitId and unitVersion");
  });

  it("rejects a source absent from the evidence pack", async () => {
    const inputSource = source();
    const client = new MockClient({
      plan_3_sentences: [],
      paragraph: "Le texte produit une assertion.",
      claims: [
        {
          statement: "Assertion",
          confidenceLevel: "certain",
          sourceIds: ["unknown-source"],
        },
      ],
      confidence_assessment: "low",
    });

    await expect(
      new ParagraphGenerator(client).generateParagraph(
        evidencePack(inputSource.id),
        [inputSource]
      )
    ).rejects.toThrow("unknown source unknown-source");
  });
});
