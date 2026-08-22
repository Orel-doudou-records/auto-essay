import { describe, expect, it } from "vitest";
import {
  createManuscript,
  ManuscriptSchema,
} from "../src/domain";

describe("Manuscript", () => {
  it("creates a valid manuscript and preserves its unit references", () => {
    const units = [
      { unitId: "unit-2", version: 1, order: 1 },
      { unitId: "unit-1", version: 2, order: 0 },
    ];

    const manuscript = createManuscript({
      projectId: "project-1",
      title: "Essay draft",
      units,
    });

    expect(manuscript).toMatchObject({
      projectId: "project-1",
      title: "Essay draft",
      units,
    });
    expect(manuscript.id).toEqual(expect.any(String));
    expect(manuscript.createdAt).toEqual(expect.any(String));
    expect(manuscript.updatedAt).toEqual(expect.any(String));
  });

  it("rejects duplicate unit orders", () => {
    const result = ManuscriptSchema.safeParse({
      id: "manuscript-1",
      projectId: "project-1",
      title: "Essay draft",
      units: [
        { unitId: "unit-1", version: 1, order: 0 },
        { unitId: "unit-2", version: 1, order: 0 },
      ],
      createdAt: "2026-07-21T10:00:00.000Z",
      updatedAt: "2026-07-21T10:00:00.000Z",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ["units"] }),
        ])
      );
    }
  });

  it("rejects duplicate references to the same unit version", () => {
    const result = ManuscriptSchema.safeParse({
      id: "manuscript-1",
      projectId: "project-1",
      title: "Essay draft",
      units: [
        { unitId: "unit-1", version: 1, order: 0 },
        { unitId: "unit-1", version: 1, order: 1 },
      ],
      createdAt: "2026-07-21T10:00:00.000Z",
      updatedAt: "2026-07-21T10:00:00.000Z",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ["units"] }),
        ])
      );
    }
  });

  it("accepts different versions of the same unit when their orders differ", () => {
    expect(
      ManuscriptSchema.parse({
        id: "manuscript-1",
        projectId: "project-1",
        title: "Essay draft",
        units: [
          { unitId: "unit-1", version: 1, order: 0 },
          { unitId: "unit-1", version: 2, order: 1 },
        ],
        createdAt: "2026-07-21T10:00:00.000Z",
        updatedAt: "2026-07-21T10:00:00.000Z",
      }).units
    ).toHaveLength(2);
  });

  it("creates manuscripts without unit references by default", () => {
    expect(
      createManuscript({ projectId: "project-1", title: "Essay draft" }).units
    ).toEqual([]);
  });

  it("does not allow callers to overwrite generated manuscript fields", () => {
    const manuscript = createManuscript({
      projectId: "project-1",
      title: "Essay draft",
      id: "caller-supplied-id",
      createdAt: "2000-01-01T00:00:00.000Z",
      updatedAt: "2000-01-01T00:00:00.000Z",
    } as any);

    expect(manuscript).toMatchObject({
      projectId: "project-1",
      title: "Essay draft",
    });
    expect(manuscript.id).not.toBe("caller-supplied-id");
    expect(manuscript.createdAt).not.toBe("2000-01-01T00:00:00.000Z");
    expect(manuscript.updatedAt).not.toBe("2000-01-01T00:00:00.000Z");
  });
});
