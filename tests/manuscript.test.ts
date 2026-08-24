import { describe, expect, it } from "vitest";
import {
  collectLeafReferences,
  createManuscript,
  createManuscriptLeaf,
  createManuscriptNode,
  ManuscriptSchema,
} from "../src/domain";

describe("Manuscript", () => {
  it("creates a valid tree and preserves its nodes and leaves", () => {
    const tree = [
      createManuscriptNode({
        id: "acte-1",
        title: "Acte I",
        text: "Préambule de l'acte.",
        children: [
          createManuscriptNode({
            id: "chap-1",
            title: "Chapitre 1",
            children: [createManuscriptLeaf("unit-1", 2)],
          }),
          createManuscriptLeaf("unit-2", 1),
        ],
      }),
    ];

    const manuscript = createManuscript({
      projectId: "project-1",
      title: "Essai",
      tree,
    });

    expect(manuscript).toMatchObject({
      projectId: "project-1",
      title: "Essai",
      tree,
    });
    expect(manuscript.id).toEqual(expect.any(String));
    expect(manuscript.createdAt).toEqual(expect.any(String));
    expect(manuscript.updatedAt).toEqual(expect.any(String));
  });

  it("accepts different versions of the same unit", () => {
    expect(
      ManuscriptSchema.parse({
        id: "manuscript-1",
        projectId: "project-1",
        title: "Essai",
        tree: [createManuscriptLeaf("unit-1", 1), createManuscriptLeaf("unit-1", 2)],
        createdAt: "2026-07-21T10:00:00.000Z",
        updatedAt: "2026-07-21T10:00:00.000Z",
      }).tree
    ).toHaveLength(2);
  });

  it("rejects duplicate references to the same unit version", () => {
    const result = ManuscriptSchema.safeParse({
      id: "manuscript-1",
      projectId: "project-1",
      title: "Essai",
      tree: [createManuscriptLeaf("unit-1", 1), createManuscriptLeaf("unit-1", 1)],
      createdAt: "2026-07-21T10:00:00.000Z",
      updatedAt: "2026-07-21T10:00:00.000Z",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ["tree"] }),
        ])
      );
    }
  });

  it("rejects duplicate node ids anywhere in the tree", () => {
    const result = ManuscriptSchema.safeParse({
      id: "manuscript-1",
      projectId: "project-1",
      title: "Essai",
      tree: [
        createManuscriptNode({
          id: "double",
          title: "Parent",
          children: [createManuscriptNode({ id: "double", title: "Enfant" })],
        }),
      ],
      createdAt: "2026-07-21T10:00:00.000Z",
      updatedAt: "2026-07-21T10:00:00.000Z",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ["tree"] }),
        ])
      );
    }
  });

  it("rejects an empty node title", () => {
    const result = ManuscriptSchema.safeParse({
      id: "manuscript-1",
      projectId: "project-1",
      title: "Essai",
      tree: [{ kind: "node", id: "n1", title: "" }],
      createdAt: "2026-07-21T10:00:00.000Z",
      updatedAt: "2026-07-21T10:00:00.000Z",
    });

    expect(result.success).toBe(false);
  });

  it("creates manuscripts without parts by default", () => {
    expect(
      createManuscript({ projectId: "project-1", title: "Essai" }).tree
    ).toEqual([]);
  });

  it("does not allow callers to overwrite generated manuscript fields", () => {
    const manuscript = createManuscript({
      projectId: "project-1",
      title: "Essai",
      id: "caller-supplied-id",
      createdAt: "2000-01-01T00:00:00.000Z",
      updatedAt: "2000-01-01T00:00:00.000Z",
    } as never);

    expect(manuscript).toMatchObject({
      projectId: "project-1",
      title: "Essai",
    });
    expect(manuscript.id).not.toBe("caller-supplied-id");
    expect(manuscript.createdAt).not.toBe("2000-01-01T00:00:00.000Z");
    expect(manuscript.updatedAt).not.toBe("2000-01-01T00:00:00.000Z");
  });

  it("collects leaf references in tree order", () => {
    const tree = [
      createManuscriptNode({
        id: "a",
        title: "A",
        children: [
          createManuscriptLeaf("unit-1", 1),
          createManuscriptNode({
            id: "b",
            title: "B",
            children: [createManuscriptLeaf("unit-2", 1)],
          }),
        ],
      }),
      createManuscriptLeaf("unit-3", 1),
    ];

    expect(collectLeafReferences(tree).map((leaf) => leaf.unitId)).toEqual([
      "unit-1",
      "unit-2",
      "unit-3",
    ]);
  });
});