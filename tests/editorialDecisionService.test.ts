import { describe, expect, it } from "vitest";
import { createContentStyleArticulation } from "../src/domain/contentStyleArticulation";
import { EditorialDecisionService } from "../src/editorial/editorialDecisionService";

function createCandidate(scope: "section" | "paragraph" = "section") {
  return createContentStyleArticulation({
    scope:
      scope === "section"
        ? {
            level: "section",
            projectId: "project-1",
            sectionId: "section-1",
          }
        : {
            level: "paragraph",
            projectId: "project-1",
            sectionId: "section-1",
            paragraphId: "paragraph-1",
          },
    contentRelationIds: ["relation-1"],
    supportingObservationIds: ["observation-1"],
    stylisticOperations: [
      {
        family: "enunciation_structure",
        category: "claim_attribution",
        operation: "attribuer les deux versions",
        target: "source_voice",
        rationale: "préserver les régimes documentaires",
      },
    ],
    intendedEffects: {
      content: ["maintenir deux versions distinctes"],
      form: ["séparer les voix documentaires"],
    },
    support: {
      level: "moderate",
      rationale: "une observation analogue existe",
      matchedObservationCount: 1,
    },
    origin: "system_proposed",
  });
}

const commitments = {
  contentCommitments: ["ne pas fusionner les deux claims"],
  formalCommitments: ["attribuer chaque version à sa source"],
  invariants: ["conserver les niveaux de confiance"],
  prohibitedShortcuts: ["ne pas résoudre artificiellement la contradiction"],
  validationNote: "Validation auteur",
};

describe("EditorialDecisionService", () => {
  it("accepts a candidate and creates an active author decision", () => {
    const service = new EditorialDecisionService();
    const result = service.accept(createCandidate(), commitments);

    expect(result.articulation.status).toBe("accepted");
    expect(result.decision.status).toBe("active");
    expect(result.decision.validation.validatedBy).toBe("author");
    expect(result.event.action).toBe("accepted");
    expect(result.event.actor).toBe("author");
  });

  it("can suspend and later accept the same articulation", () => {
    const service = new EditorialDecisionService();
    const suspended = service.suspend(createCandidate(), "À revoir");

    expect(suspended.articulation.status).toBe("suspended");

    const accepted = service.accept(suspended.articulation, commitments);
    expect(accepted.articulation.status).toBe("accepted");
    expect(accepted.decision.status).toBe("active");
  });

  it("rejects invalid transitions", () => {
    const service = new EditorialDecisionService();
    const rejected = service.reject(createCandidate(), "Non pertinent");

    expect(() => service.accept(rejected.articulation, commitments)).toThrow(
      "Cannot accept articulation"
    );
  });

  it("replaces an active decision with a new version", () => {
    const service = new EditorialDecisionService();
    const first = service.accept(createCandidate(), commitments);
    const replacementArticulation = service.modify(
      createCandidate(),
      {
        intendedEffects: {
          content: ["maintenir les deux claims et leurs limites"],
          form: ["ralentir la transition entre les sources"],
        },
      },
      commitments
    ).articulation;

    const replacement = service.replace(
      first.decision,
      replacementArticulation,
      commitments
    );

    expect(replacement.previousDecision.status).toBe("superseded");
    expect(replacement.decision.status).toBe("active");
    expect(replacement.decision.version).toBe(2);
    expect(replacement.decision.supersedesDecisionId).toBe(first.decision.id);
  });

  it("revokes an active decision immutably", () => {
    const service = new EditorialDecisionService();
    const accepted = service.accept(createCandidate(), commitments);
    const revoked = service.revoke(accepted.decision, "Décision retirée");

    expect(accepted.decision.status).toBe("active");
    expect(revoked.decision.status).toBe("revoked");
    expect(revoked.event.action).toBe("revoked");
  });
});
