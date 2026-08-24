import { describe, expect, it } from "vitest";
import type { DraftUnitStatus } from "../src/domain/draftUnit";
import type { ManuscriptLeaf } from "../src/domain/manuscript";
import {
  deriveNodeStatus,
  STATUS_WEAKNESS,
  weakerStatus,
} from "../src/domain/manuscriptStatus";

function leaf(unitId: string, version = 1): ManuscriptLeaf {
  return { kind: "leaf", unitId, version };
}

function resolveWith(statuses: Record<string, DraftUnitStatus>) {
  return (l: ManuscriptLeaf): DraftUnitStatus => statuses[l.unitId] ?? "drafting";
}

const alwaysVerifies = () => "verified" as DraftUnitStatus;

describe("weakerStatus", () => {
  it("classe les statuts selon l'ordre du cycle de vie", () => {
    expect(STATUS_WEAKNESS.drafting).toBeLessThan(STATUS_WEAKNESS.reviewing);
    expect(STATUS_WEAKNESS.reviewing).toBeLessThan(STATUS_WEAKNESS.revising);
    expect(STATUS_WEAKNESS.revising).toBeLessThan(STATUS_WEAKNESS.verified);
    expect(STATUS_WEAKNESS.verified).toBeLessThan(STATUS_WEAKNESS.published);
    expect(STATUS_WEAKNESS.published).toBeLessThan(STATUS_WEAKNESS.archived);
  });

  it("la faiblesse domine : ébauche < vérifié", () => {
    expect(weakerStatus("verified", "drafting")).toBe("drafting");
    expect(weakerStatus("drafting", "verified")).toBe("drafting");
  });

  it("égalité → le premier argument gagne", () => {
    expect(weakerStatus("verified", "verified")).toBe("verified");
  });
});

describe("deriveNodeStatus", () => {
  it("un nœud sans descendant est planifié → drafting", () => {
    const node = { kind: "node", id: "n1", title: "Partie vide", children: [] };
    expect(deriveNodeStatus(node, alwaysVerifies)).toBe("drafting");
  });

  it("un chapitre avec un enfant ébauche est ébauche", () => {
    const node = {
      kind: "node",
      id: "n1",
      title: "Chapitre",
      children: [
        { kind: "node", id: "n2", title: "Section", children: [leaf("u1")] },
        { kind: "node", id: "n3", title: "Section", children: [leaf("u2")] },
      ],
    };
    const resolve = resolveWith({ u1: "verified", u2: "drafting" });
    expect(deriveNodeStatus(node, resolve)).toBe("drafting");
  });

  it("tous vérifiés (ou plus) → vérifié", () => {
    const node = {
      kind: "node",
      id: "n1",
      title: "Acte",
      children: [
        { kind: "node", id: "n2", title: "C1", children: [leaf("u1")] },
        { kind: "node", id: "n3", title: "C2", children: [leaf("u2")] },
      ],
    };
    const resolve = resolveWith({ u1: "verified", u2: "published" });
    expect(deriveNodeStatus(node, resolve)).toBe("verified");
  });

  it("une feuille archivée ne tire pas le nœud vers l'ébauche", () => {
    const node = {
      kind: "node",
      id: "n1",
      title: "Acte",
      children: [
        { kind: "node", id: "n2", title: "C1", children: [leaf("u1")] },
        { kind: "node", id: "n3", title: "C2", children: [leaf("u2")] },
      ],
    };
    const resolve = resolveWith({ u1: "archived", u2: "verified" });
    expect(deriveNodeStatus(node, resolve)).toBe("verified");
  });

  it("la dérivation est récursive sur la profondeur libre", () => {
    const node = {
      kind: "node",
      id: "acte",
      title: "Acte",
      children: [
        {
          kind: "node",
          id: "chap",
          title: "Chapitre",
          children: [
            {
              kind: "node",
              id: "scene",
              title: "Scène",
              children: [
                {
                  kind: "node",
                  id: "beat",
                  title: "Beat",
                  children: [leaf("u")],
                },
              ],
            },
          ],
        },
      ],
    };
    const resolve = resolveWith({ u: "reviewing" });
    expect(deriveNodeStatus(node, resolve)).toBe("reviewing");
  });
});