import { describe, expect, it } from "vitest";
import {
  canBecomeEditorialDecision,
  createContentStyleArticulation,
  type PlannedStylisticOperationInput,
} from "../src/domain/contentStyleArticulation";
import { createDiffractiveReading } from "../src/domain/diffractiveReading";

describe("ContentStyleArticulation × diffractive reading", () => {
  const baseOps: PlannedStylisticOperationInput[] = [
    {
      family: "tone_lexicon",
      category: "conceptual_lexicon",
      operation: "reformulate messianic temporality through technique",
      target: "narrator_voice",
      rationale: "name the cut the fragment introduces",
    },
  ];

  it("carries an optional diffractive reading as reasoning trace", () => {
    const articulation = createContentStyleArticulation({
      scope: { level: "project", projectId: "project-1" },
      contentRelationIds: ["relation-1"],
      stylisticOperations: baseOps,
      intendedEffects: {
        content: ["reformulate temporality"],
        form: ["mark the narrator voice"],
      },
      origin: "system_proposed",
      diffractiveReading: createDiffractiveReading({
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
      }),
    });

    expect(articulation.diffractiveReading).toBeDefined();
    expect(articulation.diffractiveReading?.verdict).toBe("integrate_now");
    expect(articulation.diffractiveReading?.pass4.excluded).toEqual([
      "la lecture théologique",
    ]);
  });

  it("accepts the archived status without becoming a decision", () => {
    const articulation = createContentStyleArticulation({
      scope: { level: "project", projectId: "project-1" },
      contentRelationIds: ["relation-1"],
      stylisticOperations: baseOps,
      intendedEffects: {
        content: ["archive the fragment"],
        form: ["keep a trace"],
      },
      origin: "author_declared",
      status: "archived",
    });

    expect(articulation.status).toBe("archived");
    expect(canBecomeEditorialDecision(articulation)).toBe(false);
  });

  it("keeps backward compatibility when no reading is provided", () => {
    const articulation = createContentStyleArticulation({
      scope: { level: "project", projectId: "project-1" },
      contentRelationIds: ["relation-1"],
      stylisticOperations: baseOps,
      intendedEffects: {
        content: ["keep it simple"],
        form: ["no trace"],
      },
      origin: "author_declared",
    });

    expect(articulation.diffractiveReading).toBeUndefined();
  });
});
