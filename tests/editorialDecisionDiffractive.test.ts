import { describe, expect, it } from "vitest";
import {
  createContentStyleArticulation,
  type PlannedStylisticOperationInput,
} from "../src/domain/contentStyleArticulation";
import { createEditorialDecision } from "../src/domain/editorialDecision";
import {
  createDiffractiveReading,
  type DiffractiveReading,
} from "../src/domain/diffractiveReading";

const ops: PlannedStylisticOperationInput[] = [
  {
    family: "tone_lexicon",
    category: "conceptual_lexicon",
    operation: "reformulate messianic temporality through technique",
    target: "narrator_voice",
    rationale: "name the cut the fragment introduces",
  },
];

function acceptedArticulation(diffractiveReading?: DiffractiveReading) {
  return createContentStyleArticulation({
    scope: { level: "project", projectId: "project-1" },
    contentRelationIds: ["relation-1"],
    stylisticOperations: ops,
    intendedEffects: {
      content: ["reformulate temporality"],
      form: ["mark the narrator voice"],
    },
    origin: "system_proposed",
    status: "accepted",
    diffractiveReading,
  });
}

describe("EditorialDecision × diffractive cut", () => {
  it("carries an explicit agential cut", () => {
    const decision = createEditorialDecision(acceptedArticulation(), {
      projectId: "project-1",
      contentCommitments: ["keep the technical reformulation"],
      formalCommitments: ["mark the narrator voice"],
      cut: {
        cut: "Intégrer la reformulation technique",
        included: ["le chapitre mémoire"],
        excluded: ["la lecture théologique"],
        cutOfNonAdoption: ["perdre le pont afrofuturiste"],
      },
    });

    expect(decision.cut).toBeDefined();
    expect(decision.cut?.excluded).toEqual(["la lecture théologique"]);
  });

  it("derives the cut from the articulation's diffractive reading", () => {
    const articulation = acceptedArticulation(
      createDiffractiveReading({
        fragment: {
          statement: "La temporalité messianique se reformule par la technique.",
          claimIds: ["claim-1"],
          sourceIds: ["source-1"],
        },
        pass4: {
          cut: "Intégrer la reformulation technique",
          included: ["le chapitre mémoire"],
          excluded: ["la lecture théologique"],
          cutOfNonAdoption: ["perdre le pont afrofuturiste"],
        },
        verdict: "integrate_now",
        verdictDetail: "Intègre maintenant.",
        action: "Réécrire l'introduction.",
      })
    );

    const decision = createEditorialDecision(articulation, {
      projectId: "project-1",
      contentCommitments: ["keep the technical reformulation"],
      formalCommitments: ["mark the narrator voice"],
    });

    expect(decision.cut?.cut).toBe("Intégrer la reformulation technique");
    expect(decision.cut?.excluded).toEqual(["la lecture théologique"]);
  });

  it("keeps backward compatibility without a cut", () => {
    const decision = createEditorialDecision(acceptedArticulation(), {
      projectId: "project-1",
      contentCommitments: ["keep it simple"],
      formalCommitments: ["no cut"],
    });

    expect(decision.cut).toBeUndefined();
  });
});
