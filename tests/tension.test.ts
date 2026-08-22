import { describe, expect, it } from "vitest";
import { TensionSchema, createTension } from "../src/domain/tension";

describe("Tension", () => {
  it("creates a proposed tension with two poles", () => {
    const tension = createTension({
      projectId: "project-1",
      label: "technique contre mémoire",
      description: "L'avenir technologique entre en tension avec la mémoire rituelle.",
      scope: { level: "project", projectId: "project-1" },
      poles: ["technique", "mémoire"],
    });

    expect(tension.id).toBeDefined();
    expect(tension.poles).toEqual(["technique", "mémoire"]);
    expect(tension.status).toBe("proposed");
  });

  it("rejects a tension without a description", () => {
    expect(() =>
      TensionSchema.parse({
        id: "tension-1",
        projectId: "project-1",
        label: "exil contre rédemption",
        description: "",
        scope: { level: "project", projectId: "project-1" },
        createdAt: new Date().toISOString(),
      })
    ).toThrow();
  });
});
