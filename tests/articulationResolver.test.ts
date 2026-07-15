import { describe, expect, it } from "vitest";
import { createContentRelation } from "../src/domain/contentRelation";
import { createStyleObservation } from "../src/domain/styleObservation";
import { ArticulationResolver } from "../src/editorial/articulationResolver";

class MockStructuredClient {
  calls = 0;

  constructor(private readonly output: unknown) {}

  async generateJson(): Promise<unknown> {
    this.calls += 1;
    return this.output;
  }
}

function createFixture() {
  const relation = createContentRelation({
    scope: {
      level: "section",
      projectId: "project-1",
      sectionId: "section-1",
    },
    type: "contradicts",
    participants: [
      { kind: "claim", id: "claim-1" },
      { kind: "claim", id: "claim-2" },
    ],
    description: "Deux chronologies incompatibles décrivent le même lieu.",
    origin: "system_detected",
  });
  const observation = createStyleObservation({
    authorId: "author-1",
    sourceTextId: "text-1",
    contentConfiguration: {
      argumentativeFunction: "maintenir une contradiction documentaire",
      relations: ["deux versions incompatibles"],
    },
    formalOperations: [
      {
        family: "enunciation_structure",
        category: "claim_attribution",
        trigger: "deux sources incompatibles",
        operation: "attribuer chaque version avant de les rapprocher",
        target: "source_voice",
        observedEffect: "préserve la différence de régime",
      },
    ],
    observedEffects: {
      epistemic: ["empêche une synthèse non documentée"],
    },
    evidence: { excerpt: "Pourtant" },
    provenance: { origin: "author_text_analysis" },
    confidence: "high",
  });

  return { relation, observation };
}

function validOutput(relationId: string, observationId: string) {
  return {
    candidates: [
      {
        contentRelationIds: [relationId],
        supportingObservationIds: [observationId],
        stylisticOperations: [
          {
            family: "enunciation_structure",
            category: "claim_attribution",
            operation: "attribuer séparément les deux chronologies",
            target: "source_voice",
            rationale: "la contradiction provient de régimes documentaires distincts",
            intensity: "structuring",
          },
        ],
        intendedEffects: {
          content: ["maintenir les deux versions sans les fusionner"],
          form: ["rendre chaque voix documentaire identifiable"],
          epistemic: ["préserver les limites de chaque source"],
        },
        support: {
          level: "moderate",
          rationale: "une pratique analogue est observée dans le texte de référence",
        },
        risks: [],
        alternatives: [],
      },
    ],
  };
}

describe("ArticulationResolver", () => {
  it("creates non-executable candidates with explicit support", async () => {
    const fixture = createFixture();
    const client = new MockStructuredClient(
      validOutput(fixture.relation.id, fixture.observation.id)
    );
    const resolver = new ArticulationResolver(client);

    const candidates = await resolver.resolve({
      scope: fixture.relation.scope,
      relations: [fixture.relation],
      observations: [fixture.observation],
      projectContext: "Essai sur les régimes de disparition d'un lieu",
      argumentativeFunction: "exposer une contradiction",
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0].status).toBe("candidate");
    expect(candidates[0].origin).toBe("system_proposed");
    expect(candidates[0].support).toEqual({
      level: "moderate",
      rationale: "une pratique analogue est observée dans le texte de référence",
      matchedObservationCount: 1,
    });
  });

  it("returns no candidates and skips the model when no relation exists", async () => {
    const fixture = createFixture();
    const client = new MockStructuredClient(
      validOutput(fixture.relation.id, fixture.observation.id)
    );
    const resolver = new ArticulationResolver(client);

    const candidates = await resolver.resolve({
      scope: fixture.relation.scope,
      relations: [],
      observations: [fixture.observation],
      projectContext: "Contexte",
      argumentativeFunction: "introduire",
    });

    expect(candidates).toEqual([]);
    expect(client.calls).toBe(0);
  });

  it("rejects a candidate that invents a relation identifier", async () => {
    const fixture = createFixture();
    const client = new MockStructuredClient(
      validOutput("unknown-relation", fixture.observation.id)
    );
    const resolver = new ArticulationResolver(client);

    await expect(
      resolver.resolve({
        scope: fixture.relation.scope,
        relations: [fixture.relation],
        observations: [fixture.observation],
        projectContext: "Contexte",
        argumentativeFunction: "introduire",
      })
    ).rejects.toThrow("unknown relation unknown-relation");
  });

  it("rejects strong support backed by fewer than two observations", async () => {
    const fixture = createFixture();
    const output = validOutput(fixture.relation.id, fixture.observation.id);
    output.candidates[0].support.level = "strong";
    const resolver = new ArticulationResolver(
      new MockStructuredClient(output)
    );

    await expect(
      resolver.resolve({
        scope: fixture.relation.scope,
        relations: [fixture.relation],
        observations: [fixture.observation],
        projectContext: "Contexte",
        argumentativeFunction: "introduire",
      })
    ).rejects.toThrow("fewer than two observations");
  });
});
