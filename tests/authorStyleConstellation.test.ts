import { describe, expect, it } from "vitest";
import {
  AuthorStyleDeclarationSchema,
  deriveAuthorStyleConstellation,
} from "../src/domain/authorStyleConstellation";
import { createStyleObservation } from "../src/domain/styleObservation";

function observation(authorId: string, confidence: "low" | "medium" | "high") {
  return createStyleObservation({
    authorId,
    sourceTextId: `text-${authorId}-${confidence}`,
    contentConfiguration: {
      argumentativeFunction: "maintenir une tension documentaire",
      relations: ["source et interprétation"],
    },
    formalOperations: [
      {
        family: "enunciation_structure",
        category: "claim_attribution",
        trigger: "deux régimes de savoir se rencontrent",
        operation: "attribuer chaque énoncé avant la synthèse",
        target: "source_voice",
        observedEffect: "préserve les différences de statut documentaire",
      },
    ],
    observedEffects: {
      epistemic: ["rend les limites de chaque source visibles"],
    },
    evidence: {
      excerpt: "Chaque document garde sa voix.",
    },
    provenance: {
      origin: "author_text_analysis",
      notes: [],
    },
    confidence,
  });
}

describe("deriveAuthorStyleConstellation", () => {
  it("groups grounded observations without making the view executable", () => {
    const first = observation("author-1", "high");
    const second = observation("author-1", "medium");
    const foreign = observation("author-2", "high");
    const declaration = AuthorStyleDeclarationSchema.parse({
      id: "declaration-1",
      authorId: "author-1",
      statement: "La preuve précède l'intensité poétique.",
      scope: "global",
      status: "validated",
      provenance: "charte éditoriale",
    });

    const constellation = deriveAuthorStyleConstellation({
      authorId: "author-1",
      observations: [first, second, foreign],
      declarations: [declaration],
      validatedSignatures: ["Sceau final validé"],
      productiveTensions: ["justesse et vibration"],
      unwantedDrifts: ["métaphore décorative"],
      ethicalNotes: ["Ne pas reprendre les formulations singulières."],
    });

    expect(constellation.observationIds).toEqual([first.id, second.id]);
    expect(constellation.observedPractices).toHaveLength(1);
    expect(constellation.observedPractices[0]).toEqual(
      expect.objectContaining({
        family: "enunciation_structure",
        category: "claim_attribution",
        confidence: "medium",
      })
    );
    expect(constellation.observedPractices[0].observationIds).toEqual(
      expect.arrayContaining([first.id, second.id])
    );
    expect(constellation.declaredPreferences).toEqual([declaration]);
    expect(constellation.validatedSignatures).toEqual(["Sceau final validé"]);
    expect(constellation.productiveTensions).toEqual([
      "justesse et vibration",
    ]);
    expect(constellation.unwantedDrifts).toEqual(["métaphore décorative"]);
    expect(constellation.ethicalBoundary).toEqual({
      preserveMechanismsNotSurface: true,
      forbiddenVerbatimReuse: true,
      notes: ["Ne pas reprendre les formulations singulières."],
    });
    expect(constellation).not.toHaveProperty("generationDirectives");
    expect(constellation).not.toHaveProperty("editorialDecisionIds");
  });

  it("does not infer signatures or preferences from observations", () => {
    const constellation = deriveAuthorStyleConstellation({
      authorId: "author-1",
      observations: [observation("author-1", "high")],
    });

    expect(constellation.validatedSignatures).toEqual([]);
    expect(constellation.declaredPreferences).toEqual([]);
    expect(constellation.productiveTensions).toEqual([]);
    expect(constellation.unwantedDrifts).toEqual([]);
  });
});
