import { describe, expect, it } from "vitest";
import { createContentStyleArticulation } from "../src/domain/contentStyleArticulation";
import { EditorialDecisionService } from "../src/editorial/editorialDecisionService";
import { SectionPlanningService } from "../src/editorial/sectionPlanningService";

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

const commitments = {
  contentCommitments: ["ne pas fusionner les claims"],
  formalCommitments: ["attribuer les versions"],
};

function createDecision(scope: "section" | "paragraph") {
  const articulation = createContentStyleArticulation({
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
    contentRelationIds: [
      scope === "section" ? "relation-section" : "relation-paragraph",
    ],
    stylisticOperations: [operation],
    intendedEffects: effects,
    origin: "system_proposed",
  });

  return new EditorialDecisionService().accept(articulation, commitments).decision;
}

function paragraphRequest(localDecision = createDecision("paragraph")) {
  return {
    unitId: "unit-paragraph-1",
    unitVersion: 1,
    paragraphId: "paragraph-1",
    order: 0,
    argumentativeFunction: "exposer la divergence documentaire",
    localDecisions: [localDecision],
    claimIds: ["claim-1", "claim-2"],
    evidenceIds: ["source-1", "source-2"],
    sourceRelationIds: ["relation-section"],
    contentOperations: ["présenter les deux versions sans synthèse"],
    stylisticOperations: [operation],
    intendedEffects: effects,
    invariants: ["conserver les niveaux de confiance"],
  };
}

describe("SectionPlanningService", () => {
  it("builds draft section and paragraph plans with inherited and local decisions", () => {
    const sectionDecision = createDecision("section");
    const localDecision = createDecision("paragraph");
    const service = new SectionPlanningService();

    const section = service.build({
      unitId: "unit-section-1",
      unitVersion: 1,
      scope: {
        level: "section",
        projectId: "project-1",
        sectionId: "section-1",
      },
      argumentativeFunction: "documenter une contradiction",
      decisions: [sectionDecision],
      claimIds: ["claim-1", "claim-2"],
      evidenceIds: ["source-1", "source-2"],
      sourceRelationIds: ["relation-section"],
      contentOperations: ["maintenir deux chronologies distinctes"],
      stylisticOperations: [operation],
      intendedEffects: effects,
      paragraphs: [paragraphRequest(localDecision)],
    });

    expect(section.plan.status).toBe("draft");
    expect(section.paragraphs).toHaveLength(1);
    expect(section.paragraphs[0].inheritedDecisionIds).toEqual([
      sectionDecision.id,
    ]);
    expect(section.paragraphs[0].localDecisionIds).toEqual([
      localDecision.id,
    ]);
    expect(section.paragraphs[0].plan.decisionIds).toEqual(
      expect.arrayContaining([sectionDecision.id, localDecision.id])
    );
  });

  it("validates the section and every paragraph together", () => {
    const service = new SectionPlanningService();
    const sectionDecision = createDecision("section");
    const draft = service.build({
      unitId: "unit-section-1",
      unitVersion: 1,
      scope: {
        level: "section",
        projectId: "project-1",
        sectionId: "section-1",
      },
      argumentativeFunction: "documenter une contradiction",
      decisions: [sectionDecision],
      contentOperations: ["maintenir deux versions"],
      stylisticOperations: [operation],
      intendedEffects: effects,
      paragraphs: [paragraphRequest()],
    });

    const validated = service.validate(draft);

    expect(validated.plan.status).toBe("validated");
    expect(
      validated.paragraphs.every(
        (paragraph) => paragraph.plan.status === "validated"
      )
    ).toBe(true);
  });

  it("rejects inactive decisions", () => {
    const governance = new EditorialDecisionService();
    const active = createDecision("section");
    const revoked = governance.revoke(active).decision;
    const service = new SectionPlanningService();

    expect(() =>
      service.build({
        unitId: "unit-section-1",
        unitVersion: 1,
        scope: {
          level: "section",
          projectId: "project-1",
          sectionId: "section-1",
        },
        argumentativeFunction: "documenter une contradiction",
        decisions: [revoked],
        contentOperations: ["maintenir deux versions"],
        stylisticOperations: [operation],
        intendedEffects: effects,
        paragraphs: [paragraphRequest()],
      })
    ).toThrow("is not active");
  });

  it("rejects duplicate paragraph orders", () => {
    const service = new SectionPlanningService();
    const sectionDecision = createDecision("section");
    const first = paragraphRequest();
    const second = {
      ...paragraphRequest(),
      unitId: "unit-paragraph-2",
      paragraphId: "paragraph-2",
      order: 0,
      localDecisions: [],
    };

    expect(() =>
      service.build({
        unitId: "unit-section-1",
        unitVersion: 1,
        scope: {
          level: "section",
          projectId: "project-1",
          sectionId: "section-1",
        },
        argumentativeFunction: "documenter une contradiction",
        decisions: [sectionDecision],
        contentOperations: ["maintenir deux versions"],
        stylisticOperations: [operation],
        intendedEffects: effects,
        paragraphs: [first, second],
      })
    ).toThrow("Duplicate paragraph order 0");
  });
});
