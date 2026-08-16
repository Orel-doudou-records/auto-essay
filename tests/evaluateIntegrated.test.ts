import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { createClaim } from "../src/domain/claim";
import { createDraftUnit } from "../src/domain/draftUnit";
import { EvaluatorEditorialProjectionSchema } from "../src/domain/editorialProjection";
import { createSource } from "../src/domain/source";
import { EssayEvaluator } from "../src/evaluation/evaluateEssay";

class SequenceClient {
  prompts: string[] = [];

  constructor(private readonly outputs: unknown[]) {}

  async generateJson(prompt: string): Promise<unknown> {
    this.prompts.push(prompt);
    const next = this.outputs.shift();
    if (next === undefined) {
      throw new Error("No mock output available");
    }
    return next;
  }
}

function essayOutput(claimSupport: number = 8) {
  return {
    overallScore: claimSupport,
    dimensions: {
      claimSupport,
      citationIntegrity: claimSupport,
      counterargumentQuality: 8,
      transitionClarity: 8,
      scopeControl: 8,
      voiceConsistency: 8,
    },
    weaknesses: [],
    strongClaims: [],
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

function editorialOutput() {
  return {
    criterionResults: [
      {
        criterionId: "criterion-1",
        decisionId: "decision-1",
        articulationId: "articulation-1",
        directiveIds: ["directive-1"],
        traceIds: [],
        status: "effective",
        contentScore: 9,
        formScore: 9,
        contentFindings: ["Les versions restent distinctes."],
        formFindings: ["L'attribution demeure visible."],
        evidence: [{ excerpt: "Les archives divergent." }],
        unintendedEffects: [],
      },
    ],
    contentFormCoherence: 9,
    overallEditorialScore: 9,
    summary: "La décision produit son effet.",
  };
}

function context() {
  const source = createSource({
    projectId: "project-1",
    title: "Archive",
    content: "Les archives divergent.",
    type: "note",
  });
  const claim = createClaim({
    projectId: "project-1",
    statement: "Les archives divergent.",
    confidenceLevel: "probable",
    sourceIds: [source.id],
  });
  const unit = createDraftUnit({
    projectId: "project-1",
    granularity: "paragraph",
    content: "Les archives divergent. Cette différence suggère deux chronologies.",
    claimIds: [claim.id],
    evidencePack: {
      sourceIds: [source.id],
      supportingClaimIds: [claim.id],
      keyCitations: [],
      objections: [],
    },
    editorialPlanId: "plan-1",
    appliedDecisionIds: ["decision-1"],
    appliedArticulationIds: ["articulation-1"],
  });
  const editorialProjection = EvaluatorEditorialProjectionSchema.parse({
    id: "projection-evaluator-1",
    type: "evaluator",
    planId: "plan-1",
    unitId: unit.id,
    unitVersion: unit.version,
    scope: {
      level: "paragraph",
      projectId: "project-1",
      sectionId: "section-1",
      paragraphId: "paragraph-1",
    },
    decisionIds: ["decision-1"],
    articulationIds: ["articulation-1"],
    createdAt: new Date().toISOString(),
    criteria: [
      {
        id: "criterion-1",
        decisionId: "decision-1",
        articulationId: "articulation-1",
        directiveIds: ["directive-1"],
        instruction: "Maintenir les versions distinctes.",
        expectedContentEffects: ["préserver la contradiction"],
        expectedFormEffects: ["maintenir l'attribution"],
      },
    ],
    intendedEffects: {
      content: ["préserver la contradiction"],
      form: ["maintenir l'attribution"],
    },
  });

  return { unit, source, claim, editorialProjection };
}

describe("EssayEvaluator strict parsing", () => {
  it("accepts a complete and valid evaluation", async () => {
    const fixture = context();
    const client = new SequenceClient([essayOutput()]);

    const evaluation = await new EssayEvaluator(client).evaluate({
      unit: fixture.unit,
      sources: [fixture.source],
      claims: [fixture.claim],
    });

    expect(evaluation.overallScore).toBe(8);
    expect(evaluation.dimensions.claimSupport).toBe(8);
    expect(evaluation.verdict).toBe("keep");
  });

  it("rejects an evaluation with a missing dimension", async () => {
    const fixture = context();
    const invalidOutput = {
      ...essayOutput(),
      dimensions: {
        claimSupport: 8,
        citationIntegrity: 8,
        counterargumentQuality: 8,
        transitionClarity: 8,
        scopeControl: 8,
        // voiceConsistency is missing
      },
    };
    const client = new SequenceClient([invalidOutput]);

    await expect(
      new EssayEvaluator(client).evaluate({
        unit: fixture.unit,
        sources: [fixture.source],
        claims: [fixture.claim],
      })
    ).rejects.toBeInstanceOf(ZodError);
  });

  it("rejects an overallScore outside the [0, 10] range", async () => {
    const fixture = context();
    const client = new SequenceClient([essayOutput(12)]);

    await expect(
      new EssayEvaluator(client).evaluate({
        unit: fixture.unit,
        sources: [fixture.source],
        claims: [fixture.claim],
      })
    ).rejects.toBeInstanceOf(ZodError);
  });

  it("rejects an unknown verdict", async () => {
    const fixture = context();
    const client = new SequenceClient([
      { ...essayOutput(), verdict: "maybe" },
    ]);

    await expect(
      new EssayEvaluator(client).evaluate({
        unit: fixture.unit,
        sources: [fixture.source],
        claims: [fixture.claim],
      })
    ).rejects.toBeInstanceOf(ZodError);
  });

  it("rejects a non-object response", async () => {
    const fixture = context();
    const client = new SequenceClient(["invalid response"]);

    await expect(
      new EssayEvaluator(client).evaluate({
        unit: fixture.unit,
        sources: [fixture.source],
        claims: [fixture.claim],
      })
    ).rejects.toThrow("Evaluation output must be a JSON object");
  });
});

describe("EssayEvaluator integrated mode", () => {
  it("keeps the historical evaluator API compatible", async () => {
    const fixture = context();
    const client = new SequenceClient([essayOutput()]);
    const evaluation = await new EssayEvaluator(client).evaluate({
      unit: fixture.unit,
      sources: [fixture.source],
      claims: [fixture.claim],
    });

    expect(evaluation.verdict).toBe("keep");
    expect(client.prompts).toHaveLength(1);
    expect(client.prompts[0]).not.toContain("Contexte éditorial canonique");
  });

  it("runs independent documentary and editorial judgments", async () => {
    const fixture = context();
    const client = new SequenceClient([essayOutput(4), editorialOutput()]);
    const integrated = await new EssayEvaluator(client).evaluateIntegrated({
      unit: fixture.unit,
      sources: [fixture.source],
      claims: [fixture.claim],
      editorialProjection: fixture.editorialProjection,
      transformationTraces: [],
    });

    expect(client.prompts).toHaveLength(2);
    expect(client.prompts[0]).toContain("Contexte éditorial canonique");
    expect(client.prompts[1]).toContain("juge éditorial indépendant");
    expect(integrated.gates.documentaryIntegrity).toBe("fail");
    expect(integrated.gates.editorialCoherence).toBe("pass");
    expect(integrated.finalVerdict).toBe("revise");
  });
});
