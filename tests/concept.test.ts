import { describe, expect, it } from "vitest";
import { ConceptSchema, createConcept } from "../src/domain/concept";

describe("Concept", () => {
  it("creates a proposed concept with a definition and project scope", () => {
    const concept = createConcept({
      projectId: "project-1",
      label: "temporalité messianique",
      definition: "Un rapport au temps où passé et avenir se replient dans l'attente.",
      scope: { level: "project", projectId: "project-1" },
    });

    expect(concept.id).toBeDefined();
    expect(concept.label).toBe("temporalité messianique");
    expect(concept.status).toBe("proposed");
    expect(concept.scope.level).toBe("project");
    expect(concept.evidenceIds).toEqual([]);
  });

  it("rejects a concept without a definition", () => {
    expect(() =>
      ConceptSchema.parse({
        id: "concept-1",
        projectId: "project-1",
        label: "exil",
        definition: "",
        scope: { level: "project", projectId: "project-1" },
        createdAt: new Date().toISOString(),
      })
    ).toThrow();
  });

  it("accepts evidence ids grounding the concept in passages", () => {
    const concept = createConcept({
      projectId: "project-1",
      label: "diaspora",
      definition: "Dispersion vécue comme condition et comme horizon.",
      scope: { level: "project", projectId: "project-1" },
      evidenceIds: ["citation-1", "citation-2"],
      status: "accepted",
    });

    expect(concept.evidenceIds).toHaveLength(2);
    expect(concept.status).toBe("accepted");
  });
});
