import { describe, expect, it } from "vitest";
import {
  createManuscript,
  createManuscriptLeaf,
  createManuscriptNode,
} from "../src/domain";
import {
  isScopeResolvable,
  resolveScopeNodeIds,
} from "../src/domain/scopeResolution";
import type { EditorialScope } from "../src/domain/contentRelation";

function sampleManuscript() {
  return createManuscript({
    projectId: "projet-1",
    title: "Judéofuturisme",
    tree: [
      createManuscriptNode({
        id: "acte-1",
        title: "Acte I",
        children: [
          createManuscriptNode({
            id: "chap-1",
            title: "Chapitre 1",
            children: [createManuscriptLeaf("u1", 1)],
          }),
          createManuscriptNode({
            id: "chap-2",
            title: "Chapitre 2",
            children: [createManuscriptLeaf("u2", 1)],
          }),
        ],
      }),
      createManuscriptNode({ id: "acte-2", title: "Acte II" }),
    ],
  });
}

function scope(partial: Partial<EditorialScope>): EditorialScope {
  return { level: "project", projectId: "projet-1", ...partial } as EditorialScope;
}

describe("resolveScopeNodeIds", () => {
  it("un scope projet couvre tous les nœuds de l'arbre (pas les feuilles)", () => {
    const manuscript = sampleManuscript();
    expect(resolveScopeNodeIds(manuscript, scope({ level: "project" })).sort()).toEqual(
      ["acte-1", "acte-2", "chap-1", "chap-2"].sort()
    );
  });

  it("un scope section cible le nœud nommé", () => {
    const manuscript = sampleManuscript();
    expect(
      resolveScopeNodeIds(
        manuscript,
        scope({ level: "section", sectionId: "chap-2" })
      )
    ).toEqual(["chap-2"]);
  });

  it("un scope paragraphe cible le nœud paragraphe", () => {
    const manuscript = sampleManuscript();
    expect(
      resolveScopeNodeIds(
        manuscript,
        scope({ level: "paragraph", sectionId: "chap-1", paragraphId: "chap-1" })
      )
    ).toEqual(["chap-1"]);
  });

  it("refuse un id de nœud inconnu", () => {
    const manuscript = sampleManuscript();
    expect(() =>
      resolveScopeNodeIds(
        manuscript,
        scope({ level: "section", sectionId: "chap-inexistant" })
      )
    ).toThrow("chap-inexistant");
    expect(() =>
      resolveScopeNodeIds(
        manuscript,
        scope({ level: "paragraph", sectionId: "n'importe-quoi", paragraphId: "chap-1" })
      )
    ).toThrow("n'importe-quoi");
  });

  it("isScopeResolvable renvoie un booléen sans lever", () => {
    const manuscript = sampleManuscript();
    expect(
      isScopeResolvable(
        manuscript,
        scope({ level: "section", sectionId: "chap-1" })
      )
    ).toBe(true);
    expect(
      isScopeResolvable(
        manuscript,
        scope({ level: "section", sectionId: "introuvable" })
      )
    ).toBe(false);
  });
});