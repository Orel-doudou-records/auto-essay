import { describe, expect, it } from "vitest";
import {
  EssayProjectSchema,
  createEssayProject,
} from "../src/domain/essayProject";

describe("EssayProject", () => {
  it("creates a project with empty concept and tension catalogs by default", () => {
    const project = createEssayProject({ title: "Judéofuturisme" });

    expect(project.conceptIds).toEqual([]);
    expect(project.tensionIds).toEqual([]);
  });

  it("accepts a populated concept and tension catalog", () => {
    const project = createEssayProject({
      title: "Judéofuturisme",
      conceptIds: ["concept-1", "concept-2"],
      tensionIds: ["tension-1"],
    });

    expect(project.conceptIds).toHaveLength(2);
    expect(project.tensionIds).toEqual(["tension-1"]);
  });

  it("validates conceptIds as an array of strings", () => {
    expect(() =>
      EssayProjectSchema.parse({
        id: "project-1",
        title: "X",
        thesisSeed: "",
        contextScope: "",
        conceptIds: [42],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    ).toThrow();
  });
});
