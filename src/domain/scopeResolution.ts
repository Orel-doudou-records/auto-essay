import type { EditorialScope } from "./contentRelation";
import type { Manuscript } from "./manuscript";
import { collectNodeIds } from "./manuscript";

/**
 * Résolution d'une portée éditoriale contre l'arbre du manuscrit.
 *
 * Contrat (ADR-006, R2-Q2) : les cibles des `EditorialScope` sont des
 * ids de NŒUDS de l'arbre — `sectionId` et `paragraphId` ne sont pas des
 * positions textuelles mais des identifiants de nœuds. Un nœud désigne
 * sa sous-partie entière (titre + texte propre + descendants).
 *
 * - level "project" → tous les nœuds de l'arbre ;
 * - level "section" → le nœud `sectionId` ;
 * - level "paragraph" → le nœud `paragraphId` (avec `sectionId` comme
 *   ancêtre nommé, pour la lecture).
 *
 * Throws si un identifiant référencé n'existe pas dans l'arbre (incohérence
 * signalée tôt, pas au moment de l'exécution).
 */
export function resolveScopeNodeIds(
  manuscript: Manuscript,
  scope: EditorialScope
): string[] {
  const nodeIds = new Set(collectNodeIds(manuscript.tree));

  switch (scope.level) {
    case "project":
      return [...nodeIds];
    case "section": {
      if (scope.sectionId === undefined) {
        throw new Error("A section scope requires sectionId");
      }
      assertNodeExists(nodeIds, scope.sectionId);
      return [scope.sectionId];
    }
    case "paragraph": {
      if (scope.sectionId === undefined || scope.paragraphId === undefined) {
        throw new Error("A paragraph scope requires sectionId and paragraphId");
      }
      assertNodeExists(nodeIds, scope.paragraphId);
      if (!nodeIds.has(scope.sectionId)) {
        throw new Error(`Unknown section node: ${scope.sectionId}`);
      }
      return [scope.paragraphId];
    }
  }
}

export function isScopeResolvable(manuscript: Manuscript, scope: EditorialScope): boolean {
  try {
    resolveScopeNodeIds(manuscript, scope);
    return true;
  } catch {
    return false;
  }
}

function assertNodeExists(nodeIds: Set<string>, id: string): void {
  if (!nodeIds.has(id)) {
    throw new Error(`Unknown manuscript node: ${id}`);
  }
}