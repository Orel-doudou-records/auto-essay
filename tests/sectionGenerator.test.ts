import { describe, expect, it } from "vitest";
import { createSource } from "../src/domain/source";
import { createContentStyleArticulation } from "../src/domain/contentStyleArticulation";
import type { EvidencePack } from "../src/domain/draftUnit";
import { EditorialDecisionService } from "../src/editorial/editorialDecisionService";
import { SectionPlanningService } from "../src/editorial/sectionPlanningService";
import { ParagraphGenerator } from "../src/pipeline/paragraphMode";
import { SectionGenerator } from "../src/pipeline/sectionGenerator";

class SequentialClient {
  prompts: string[] = [];
  private index = 0;

  constructor(private readonly outputs: Array<unknown | Error>) {}

  async generateJson(prompt: string): Promise<unknown> {
    this.prompts.push(prompt);
    const output = this.outputs[this.index++];
    if (output instanceof Error) {
      throw output;
    }
    return output;
  }
}

const operation = {
  family: "enunciation_structure" as const,
  category: "claim_attribution" as const,
  operation: "attribuer chaque version à sa source",
  target: "source_voice" as const,
  rationale: "préserver les régimes documentaires",
};

const effects = {
  content: ["maintenir les versions distinctes"],
  form: ["séparer les voix documentaires"],
};

function createFixture() {
  const inputSource = createSource({
    projectId: "project-1",
    title: "Archive",
    content: "Contenu",
    type: "pdf",
  });
  const candidate = createContentStyleArticulation({
    scope: {
      level: "section",
      projectId: "project-1",
      sectionId: "section-1",
    },
    contentRelationIds: ["relation-1"],
    stylisticOperations: [operation],
    intendedEffects: effects,
    origin: "system_proposed",
  });
  const accepted = new EditorialDecisionService().accept(candidate, {
    contentCommitments: ["ne pas fusionner les claims"],
    formalCommitments: ["attribuer chaque version"],
    invariants: ["conserver les niveaux de confiance"],
  });
  const paragraph = (unitId: string, paragraphId: string, order: number) => ({
    unitId,
    unitVersion: 1,
    paragraphId,
    order,
    argumentativeFunction: `mouvement ${order + 1}`,
    claimIds: ["claim-1"],
    evidenceIds: [inputSource.id],
    sourceRelationIds: ["relation-1"],
    contentOperations: ["présenter la source"],
    stylisticOperations: [operation],
    intendedEffects: effects,
  });
  const draftPlan = new SectionPlanningService().build({
    unitId: "section-unit",
    unitVersion: 1,
    scope: {
      level: "section",
      projectId: "project-1",
      sectionId: "section-1",
    },
    argumentativeFunction: "exposer une contradiction",
    decisions: [accepted.decision],
    claimIds: ["claim-1"],
    evidenceIds: [inputSource.id],
    sourceRelationIds: ["relation-1"],
    contentOperations: ["maintenir deux versions"],
    stylisticOperations: [operation],
    intendedEffects: effects,
    paragraphs: [
      paragraph("paragraph-unit-2", "paragraph-2", 1),
      paragraph("paragraph-unit-1", "paragraph-1", 0),
    ],
  });
  const plan = new SectionPlanningService().validate(draftPlan);
  const evidencePack: EvidencePack = {
    sourceIds: [inputSource.id],
    keyCitations: [],
    supportingClaimIds: ["claim-1"],
    objections: [],
  };

  return {
    source: inputSource,
    articulation: accepted.articulation,
    decision: accepted.decision,
    plan,
    evidencePack,
  };
}

function modelOutput(
  content: string,
  decisionId: string,
  articulationId: string,
  sourceId: string
) {
  return {
    plan_3_sentences: ["Mouvement"],
    paragraph: content,
    claims: [
      {
        statement: "La source propose une version située.",
        confidenceLevel: "probable",
        sourceIds: [sourceId],
      },
    ],
    confidence_assessment: "medium",
    applied_directives: [
      {
        directiveId: `${decisionId}:content:0`,
        decisionId,
        articulationId,
        declaration: "Maintien de la version attribuée",
        excerpt: content,
      },
    ],
  };
}

describe("SectionGenerator", () => {
  it("generates paragraphs in plan order and assembles a section", async () => {
    const fixture = createFixture();
    const firstContent = "Premier mouvement attribué à la source.";
    const secondContent = "Second mouvement qui conserve la divergence.";
    const client = new SequentialClient([
      modelOutput(
        firstContent,
        fixture.decision.id,
        fixture.articulation.id,
        fixture.source.id
      ),
      modelOutput(
        secondContent,
        fixture.decision.id,
        fixture.articulation.id,
        fixture.source.id
      ),
    ]);
    const generator = new SectionGenerator(new ParagraphGenerator(client));

    const result = await generator.generate({
      plan: fixture.plan,
      decisions: [fixture.decision],
      articulations: [fixture.articulation],
      paragraphs: [
        {
          unitId: "paragraph-unit-2",
          evidencePack: fixture.evidencePack,
          sources: [fixture.source],
        },
        {
          unitId: "paragraph-unit-1",
          evidencePack: fixture.evidencePack,
          sources: [fixture.source],
        },
      ],
      sectionTitle: "Section test",
    });

    expect(result.paragraphs.map((paragraph) => paragraph.id)).toEqual([
      "paragraph-unit-1",
      "paragraph-unit-2",
    ]);
    expect(client.prompts[1]).toContain(firstContent);
    expect(result.section.id).toBe("section-unit");
    expect(result.section.granularity).toBe("section");
    expect(result.section.content).toBe(`${firstContent}\n\n${secondContent}`);
    expect(result.transformationTraces).toHaveLength(2);
    expect(result.section.transformationTraceIds).toEqual(
      result.transformationTraces.map((trace) => trace.id)
    );
  });

  it("rejects a draft section plan before calling the writer", async () => {
    const fixture = createFixture();
    const client = new SequentialClient([]);
    const generator = new SectionGenerator(new ParagraphGenerator(client));

    await expect(
      generator.generate({
        plan: {
          ...fixture.plan,
          plan: { ...fixture.plan.plan, status: "draft" },
        },
        decisions: [fixture.decision],
        articulations: [fixture.articulation],
        paragraphs: [],
      })
    ).rejects.toThrow("is not validated");
    expect(client.prompts).toHaveLength(0);
  });

  it("does not return a partial section when a paragraph fails", async () => {
    const fixture = createFixture();
    const client = new SequentialClient([
      modelOutput(
        "Premier mouvement.",
        fixture.decision.id,
        fixture.articulation.id,
        fixture.source.id
      ),
      new Error("writer failure"),
    ]);
    const generator = new SectionGenerator(new ParagraphGenerator(client));

    await expect(
      generator.generate({
        plan: fixture.plan,
        decisions: [fixture.decision],
        articulations: [fixture.articulation],
        paragraphs: [
          {
            unitId: "paragraph-unit-1",
            evidencePack: fixture.evidencePack,
            sources: [fixture.source],
          },
          {
            unitId: "paragraph-unit-2",
            evidencePack: fixture.evidencePack,
            sources: [fixture.source],
          },
        ],
      })
    ).rejects.toThrow("writer failure");
    expect(client.prompts).toHaveLength(2);
  });

  it("rejects execution inputs that do not cover all paragraph plans", async () => {
    const fixture = createFixture();
    const client = new SequentialClient([]);
    const generator = new SectionGenerator(new ParagraphGenerator(client));

    await expect(
      generator.generate({
        plan: fixture.plan,
        decisions: [fixture.decision],
        articulations: [fixture.articulation],
        paragraphs: [
          {
            unitId: "paragraph-unit-1",
            evidencePack: fixture.evidencePack,
            sources: [fixture.source],
          },
        ],
      })
    ).rejects.toThrow("Missing execution input for paragraph unit paragraph-unit-2");
    expect(client.prompts).toHaveLength(0);
  });
});
