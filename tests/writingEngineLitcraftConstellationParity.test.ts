import { describe, expect, it } from "vitest";
import { deriveAuthorStyleConstellation as deriveSharedConstellation } from "writing-engine";
import {
  AuthorStyleDeclarationSchema,
  deriveAuthorStyleConstellation as deriveAutoEssayConstellation,
} from "../src/domain/authorStyleConstellation";
import { createStyleObservation } from "../src/domain/styleObservation";
import { toWritingEngineStyleObservation } from "../src/editorial/writingEngineLitcraftAdapter";

function observation(
  authorId: string,
  confidence: "low" | "medium" | "high",
  sourceTextId: string,
  extraEffect: string
) {
  return createStyleObservation({
    authorId,
    sourceTextId,
    contentConfiguration: {
      argumentativeFunction: "maintain a documentary contradiction",
      claimTypes: ["interpretation"],
      sourceRegimes: ["testimony"],
      relations: ["incompatible chronologies"],
    },
    formalOperations: [
      {
        family: "enunciation_structure",
        category: "source_distance",
        trigger: "two incompatible accounts remain active",
        operation: "attribute each account before any synthesis",
        target: "source_voice",
        observedEffect: "the accounts remain distinguishable",
        intensity: "structuring",
      },
    ],
    observedEffects: {
      argumentative: ["the contradiction remains explicit"],
      epistemic: [
        "the source regimes remain distinct",
        "the source regimes remain distinct",
      ],
      reception: [extraEffect],
    },
    evidence: {
      excerpt: "Each account keeps its own chronology.",
    },
    provenance: {
      origin: "author_text_analysis",
      notes: ["parity fixture"],
    },
    confidence,
  });
}

function withoutDerivedAt<T extends { derivedAt: string }>(value: T) {
  const { derivedAt: _derivedAt, ...rest } = value;
  return rest;
}

describe("Writing Engine AuthorStyleConstellation parity", () => {
  it("matches AutoEssay durable constellation semantics", () => {
    const first = observation(
      "author-1",
      "high",
      "text-1",
      "the reader compares the accounts"
    );
    const second = observation(
      "author-1",
      "medium",
      "text-2",
      "the reader keeps the contradiction open"
    );
    const foreign = observation(
      "author-2",
      "low",
      "text-3",
      "foreign effect"
    );

    const declaration = AuthorStyleDeclarationSchema.parse({
      id: "declaration-1",
      authorId: "author-1",
      statement: "Do not explain away a productive contradiction.",
      status: "validated",
      provenance: "author charter",
    });
    const foreignDeclaration = AuthorStyleDeclarationSchema.parse({
      id: "declaration-foreign",
      authorId: "author-2",
      statement: "Foreign preference",
      provenance: "other author",
    });

    const common = {
      authorId: "author-1",
      observations: [first, second, foreign],
      declarations: [declaration, foreignDeclaration],
      validatedSignatures: [
        "material perception before explanation",
        "material perception before explanation",
      ],
      productiveTensions: ["distance and proximity", "distance and proximity"],
      unwantedDrifts: ["decorative ambiguity", "decorative ambiguity"],
      ethicalNotes: [
        "Never reuse singular wording verbatim.",
        "Never reuse singular wording verbatim.",
      ],
    };

    const autoEssay = deriveAutoEssayConstellation(common);
    const shared = deriveSharedConstellation({
      ...common,
      observations: common.observations.map(toWritingEngineStyleObservation),
    });

    expect(withoutDerivedAt(shared)).toEqual(withoutDerivedAt(autoEssay));
    expect(shared.observationIds).toEqual([first.id, second.id]);
    expect(shared.observedPractices).toHaveLength(1);
    expect(shared.observedPractices[0]).toEqual(
      expect.objectContaining({
        family: "enunciation_structure",
        category: "source_distance",
        confidence: "medium",
        observationIds: [first.id, second.id],
        operations: ["attribute each account before any synthesis"],
        triggers: ["two incompatible accounts remain active"],
        observedEffects: [
          "the accounts remain distinguishable",
          "the contradiction remains explicit",
          "the source regimes remain distinct",
          "the reader compares the accounts",
          "the reader keeps the contradiction open",
        ],
      })
    );
    expect(shared.declaredPreferences).toEqual([declaration]);
    expect(shared.validatedSignatures).toEqual([
      "material perception before explanation",
    ]);
    expect(shared.productiveTensions).toEqual(["distance and proximity"]);
    expect(shared.unwantedDrifts).toEqual(["decorative ambiguity"]);
    expect(shared.ethicalBoundary).toEqual({
      preserveMechanismsNotSurface: true,
      forbiddenVerbatimReuse: true,
      notes: ["Never reuse singular wording verbatim."],
    });
  });
});
