import { describe, expect, it } from "vitest";
import { createContentStyleArticulation } from "../src/domain/contentStyleArticulation";
import { createEditorialPlan } from "../src/domain/editorialPlan";
import { EditorialDecisionSchema } from "../src/domain/editorialDecision";
import { EditorialDecisionService } from "../src/editorial/editorialDecisionService";
import { ProjectionCompiler } from "../src/editorial/projectionCompiler";

function createFixture() {
  const candidate = createContentStyleArticulation({
    scope: {
      level: "paragraph",
      projectId: "project-1",
      sectionId: "section-1",
      paragraphId: "paragraph-1",
    },
    contentRelationIds: ["relation-1"],
    stylisticOperations: [
      {
        family: "enunciation_structure",
        category: "claim_attribution",
        operation: "attribuer séparément les versions",
        target: "source_voice",
        rationale: "préserver la différence documentaire",
      },
    ],
    intendedEffects: {
      content: ["maintenir deux claims distincts"],
      form: ["séparer les voix documentaires"],
    },
    origin: "system_proposed",
  });
  const accepted = new EditorialDecisionService().accept(candidate, {
    contentCommitments: ["ne pas fusionner les claims"],
    formalCommitments: ["attribuer chaque version"],
    invariants: ["conserver les niveaux de confiance"],
    prohibitedShortcuts: ["ne pas résoudre artificiellement"],
  });
  const plan = createEditorialPlan({
    unitId: "unit-1",
    unitVersion: 1,
    scope: accepted.articulation.scope,
    argumentativeFunction: "exposer une contradiction",
    decisions: [accepted.decision],
    claimIds: ["claim-1", "claim-2"],
    evidenceIds: ["source-1", "source-2"],
    sourceRelationIds: ["relation-1"],
    contentOperations: ["présenter deux versions"],
    stylisticOperations: accepted.articulation.stylisticOperations,
    intendedEffects: accepted.articulation.intendedEffects,
    invariants: ["conserver les niveaux de confiance"],
    status: "validated",
  });

  return {
    articulation: accepted.articulation,
    decision: accepted.decision,
    plan,
  };
}

describe("ProjectionCompiler", () => {
  it("derives three projections from the same canonical plan", () => {
    const fixture = createFixture();
    const bundle = new ProjectionCompiler().compile({
      plan: fixture.plan,
      decisions: [fixture.decision],
      articulations: [fixture.articulation],
    });

    expect(bundle.writer.planId).toBe(fixture.plan.id);
    expect(bundle.evaluator.planId).toBe(fixture.plan.id);
    expect(bundle.revision.planId).toBe(fixture.plan.id);
    expect(bundle.writer.decisionIds).toEqual([fixture.decision.id]);
    expect(bundle.writer.allowedClaimIds).toEqual(["claim-1", "claim-2"]);
    expect(bundle.writer.allowedEvidenceIds).toEqual(["source-1", "source-2"]);
    expect(bundle.writer.directives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          decisionId: fixture.decision.id,
          articulationId: fixture.articulation.id,
          kind: "content",
        }),
        expect.objectContaining({
          decisionId: fixture.decision.id,
          articulationId: fixture.articulation.id,
          operation: fixture.articulation.stylisticOperations[0],
        }),
      ])
    );
    expect(bundle.revision.preserve).toContain(
      "conserver les niveaux de confiance"
    );
    expect(bundle.revision.avoid).toContain(
      "ne pas résoudre artificiellement"
    );
  });

  it("rejects an unvalidated plan", () => {
    const fixture = createFixture();

    expect(() =>
      new ProjectionCompiler().compile({
        plan: { ...fixture.plan, status: "draft" },
        decisions: [fixture.decision],
        articulations: [fixture.articulation],
      })
    ).toThrow("must be validated");
  });

  it("rejects an inactive decision even when its id is in the plan", () => {
    const fixture = createFixture();
    const revoked = EditorialDecisionSchema.parse({
      ...fixture.decision,
      status: "revoked",
      updatedAt: new Date().toISOString(),
    });

    expect(() =>
      new ProjectionCompiler().compile({
        plan: fixture.plan,
        decisions: [revoked],
        articulations: [fixture.articulation],
      })
    ).toThrow("inactive decision");
  });
});
