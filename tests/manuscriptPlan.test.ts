import { describe, expect, it } from "vitest";
import {
  createManuscript,
  createManuscriptNode,
  createPlanEntry,
  createPlanNote,
  collectPlanEntries,
  collectPlanEntryIds,
  ManuscriptNodeSchema,
  ManuscriptSchema,
  PlanEntrySchema,
  PlanNoteSchema,
} from "../src/domain";

describe("PlanNote", () => {
  it("accepte une note humaine ou agent avec horodatage", () => {
    const note = PlanNoteSchema.parse({
      kind: "human",
      text: "Il faut garder l'anecdote du salon pour le contraste.",
      createdAt: "2026-08-24T12:00:00.000Z",
    });
    expect(note).toEqual({
      kind: "human",
      text: "Il faut garder l'anecdote du salon pour le contraste.",
      createdAt: "2026-08-24T12:00:00.000Z",
    });
    expect(PlanNoteSchema.parse({ ...note, kind: "agent" }).kind).toBe("agent");
  });

  it("refuse un auteur inconnu", () => {
    const result = PlanNoteSchema.safeParse({
      kind: "robot",
      text: "x",
      createdAt: "2026-08-24T12:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("createPlanNote génère un horodatage", () => {
    const note = createPlanNote("agent", "aperçu rédigé");
    expect(note.kind).toBe("agent");
    expect(note.text).toBe("aperçu rédigé");
    expect(new Date(note.createdAt).getTime()).not.toBeNaN();
  });
});

describe("PlanEntry", () => {
  it("génère un id et un notes[] vide par défaut", () => {
    const entry = createPlanEntry("Le salon");
    expect(entry.id).toBeTruthy();
    expect(entry.subject).toBe("Le salon");
    expect(entry.preview).toBeUndefined();
    expect(entry.notes).toEqual([]);
  });

  it("accepte un preview et des notes", () => {
    const entry = PlanEntrySchema.parse({
      id: "p1",
      subject: "Le salon",
      preview: "Le salon décrit la scène domestique d'où émerge la mémoire.",
      notes: [createPlanNote("agent", "résumé validé")],
    });
    expect(entry.preview).toContain("scène domestique");
    expect(entry.notes).toHaveLength(1);
  });

  it("refuse un sujet vide", () => {
    expect(PlanEntrySchema.safeParse({ id: "p1", subject: "" }).success).toBe(
      false
    );
  });
});

describe("plan dans l'arbre du manuscrit", () => {
  it("un chapitre porte un plan ordonné et des notes", () => {
    const manuscript = createManuscript({
      projectId: "projet-1",
      title: "Judéofuturisme",
      tree: [
        createManuscriptNode({
          id: "chap-2",
          title: "Chapitre 2",
          plan: [
            createPlanEntry("Le salon"),
            createPlanEntry("Le shabbat et la part du pauvre"),
            createPlanEntry("Abikou et le rêve prémonitoire"),
          ],
          notes: [createPlanNote("human", "à compléter avec la transition")],
        }),
      ],
    });

    const chapter = manuscript.tree[0];
    expect(chapter.kind).toBe("node");
    if (chapter.kind === "node") {
      expect(chapter.plan).toHaveLength(3);
      expect(chapter.plan?.[0].subject).toBe("Le salon");
      expect(chapter.plan?.[2].subject).toBe("Abikou et le rêve prémonitoire");
      expect(chapter.notes).toHaveLength(1);
    }
  });

  it("collectPlanEntries parcourt l'arbre dans l'ordre", () => {
    const manuscript = createManuscript({
      projectId: "projet-1",
      title: "Essai",
      tree: [
        createManuscriptNode({
          id: "chap-1",
          title: "Chapitre 1",
          plan: [createPlanEntry("A"), createPlanEntry("B")],
          children: [
            createManuscriptNode({
              id: "chap-1-1",
              title: "Sous-partie",
              plan: [createPlanEntry("C")],
            }),
          ],
        }),
        createManuscriptNode({
          id: "chap-2",
          title: "Chapitre 2",
          plan: [createPlanEntry("D")],
        }),
      ],
    });

    const subjects = collectPlanEntries(manuscript.tree).map((e) => e.subject);
    expect(subjects).toEqual(["A", "B", "C", "D"]);
    expect(collectPlanEntryIds(manuscript.tree)).toHaveLength(4);
  });

  it("refuse deux entrées de plan avec le même id (même dans des nœuds différents)", () => {
    const result = ManuscriptSchema.safeParse({
      id: "m1",
      projectId: "projet-1",
      title: "Essai",
      tree: [
        {
          kind: "node",
          id: "chap-1",
          title: "Chapitre 1",
          children: [],
          plan: [{ id: "p-dupliqué", subject: "A" }],
        },
        {
          kind: "node",
          id: "chap-2",
          title: "Chapitre 2",
          children: [],
          plan: [{ id: "p-dupliqué", subject: "B" }],
        },
      ],
      createdAt: "2026-08-24T12:00:00.000Z",
      updatedAt: "2026-08-24T12:00:00.000Z",
    });

    expect(result.success).toBe(false);
  });

  it("un nœud sans plan ni notes reste valide (rétro-compatible)", () => {
    const node = ManuscriptNodeSchema.parse({
      kind: "node",
      id: "chap-1",
      title: "Chapitre 1",
      children: [],
    });
    expect(node.plan).toBeUndefined();
    expect(node.notes).toBeUndefined();
  });
});