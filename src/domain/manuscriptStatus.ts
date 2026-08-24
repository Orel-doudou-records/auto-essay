import type { DraftUnitStatus } from "./draftUnit";
import type { ManuscriptLeaf, ManuscriptNode } from "./manuscript";

/**
 * Résolution du statut d'une feuille (version d'unité) : à priori le statut
 * de la version référencée (ADR-006, D4). Sans I/O : le résolveur est injecté.
 */
export type ResolveLeafStatus = (leaf: ManuscriptLeaf) => DraftUnitStatus;

/**
 * Échelle de « faiblesse » des statuts, dans l'ordre du cycle de vie de
 * l'unité : drafting (ébauche) < reviewing < revising < verified < published.
 * `archived` est volontairement le plus FORT : une unité archivée est hors du
 * chemin actif et ne doit pas tirer un chapitre vers l'ébauche. (Choix
 * documenté ADR-006, R2-Q3.)
 */
export const STATUS_WEAKNESS: Record<DraftUnitStatus, number> = {
  drafting: 0,
  reviewing: 1,
  revising: 2,
  verified: 3,
  published: 4,
  archived: 5,
};

export function weakerStatus(
  a: DraftUnitStatus,
  b: DraftUnitStatus
): DraftUnitStatus {
  return STATUS_WEAKNESS[a] <= STATUS_WEAKNESS[b] ? a : b;
}

/**
 * Statut d'un nœud non-feuille = le plus faible de ses descendants
 * (ADR-006, R2-Q3). Un nœud sans descendant est planifié → `drafting`
 * (le plus faible, légitime pour une partie pas encore écrite).
 */
export function deriveNodeStatus(
  node: ManuscriptNode,
  resolveLeafStatus: ResolveLeafStatus
): DraftUnitStatus {
  let weakest: DraftUnitStatus | null = null;
  for (const child of node.children) {
    const childStatus =
      child.kind === "leaf"
        ? resolveLeafStatus(child)
        : deriveNodeStatus(child, resolveLeafStatus);
    weakest =
      weakest === null ? childStatus : weakerStatus(weakest, childStatus);
  }
  return weakest ?? "drafting";
}