import { describe, expect, it } from "vitest";
import type { DraftUnitStatus } from "../src/domain/draftUnit";
import {
  createManuscript,
  createManuscriptLeaf,
  createManuscriptNode,
} from "../src/domain";
import { projectBookState } from "../src/editorial/projectBookState";

describe("projectBookState", () => {
  it("projette un acte avec préambule puis ses chapitres (feuilles)", () => {
    const manuscript = createManuscript({
      projectId: "projet-1",
      title: "Judéofuturisme",
      tree: [
        createManuscriptNode({
          id: "acte-1",
          title: "Acte I — La machine à différer",
          text: "Préambule de l'acte.",
          children: [
            createManuscriptNode({
              id: "chap-1",
              title: "Chapitre 1 — Diaspora",
              children: [createManuscriptLeaf("u1", 3)],
            }),
            createManuscriptNode({
              id: "chap-2",
              title: "Chapitre 2 — Messianisme",
              children: [createManuscriptLeaf("u2", 1)],
            }),
          ],
        }),
      ],
    });
    const resolveLeaf = (leaf: {
      unitId: string;
      version: number;
    }): { status: DraftUnitStatus; text: string } =>
      leaf.unitId === "u2"
        ? { status: "drafting", text: "" }
        : { status: "verified", text: "Contenu du chapitre 1." };

    const parts = projectBookState(manuscript, { resolveLeaf });

    expect(parts).toEqual([
      {
        id: "acte-1",
        title: "Acte I — La machine à différer",
        status: "drafting", // le plus faible des descendants (u2 ébauche)
        text: "Préambule de l'acte.",
      },
      {
        id: "unit:u1:3",
        title: "Chapitre 1 — Diaspora",
        status: "verified",
        text: "Contenu du chapitre 1.",
      },
      {
        id: "unit:u2:1",
        title: "Chapitre 2 — Messianisme",
        status: "drafting",
        text: "",
      },
    ]);
  });

  it("une feuille d'un acte qui n'a pas de nœud chapitre hérite du titre de l'acte", () => {
    const manuscript = createManuscript({
      projectId: "projet-1",
      title: "Essai",
      tree: [
        createManuscriptNode({
          id: "acte-1",
          title: "Acte I",
          children: [createManuscriptLeaf("u1", 1)],
        }),
      ],
    });
    const resolveLeaf = (leaf: { unitId: string }) => ({
      status: "published" as const,
      text: `Contenu de ${leaf.unitId}.`,
    });

    const parts = projectBookState(manuscript, { resolveLeaf });

    expect(parts).toEqual([
      {
        id: "unit:u1:1",
        title: "Acte I",
        status: "published",
        text: "Contenu de u1.",
      },
    ]);
  });

  it("une partie planifiée (nœud sans enfant ni texte) est une partie vide", () => {
    const manuscript = createManuscript({
      projectId: "projet-1",
      title: "Essai",
      tree: [createManuscriptNode({ id: "acte-2", title: "Acte II" })],
    });

    const parts = projectBookState(manuscript);

    expect(parts).toEqual([
      { id: "acte-2", title: "Acte II", status: "drafting", text: "" },
    ]);
  });

  it("une feuille sans résolveur est planifiée (drafting, texte vide)", () => {
    const manuscript = createManuscript({
      projectId: "projet-1",
      title: "Essai",
      tree: [createManuscriptLeaf("u9", 2)],
    });

    const parts = projectBookState(manuscript);

    expect(parts).toEqual([
      { id: "unit:u9:2", title: "Unité u9@2", status: "drafting", text: "" },
    ]);
  });
});