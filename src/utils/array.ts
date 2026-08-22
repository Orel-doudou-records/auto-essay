/**
 * Utilitaires de manipulation de collections.
 *
 * Ces fonctions sont intentionnellement triviales : elles évitent la
 * duplication d'implémentations identiques dans plusieurs modules.
 */

/** Retourne les valeurs uniques d'un tableau de chaînes. */
export function unique(values: string[]): string[] {
  return [...new Set(values)];
}

/** Compare deux ensembles de chaînes pour l'égalité. */
export function sameStringSet(
  left: string[] | Set<string>,
  right: string[] | Set<string>
): boolean {
  const leftSet = left instanceof Set ? left : new Set(left);
  const rightSet = right instanceof Set ? right : new Set(right);

  if (Array.isArray(left) && leftSet.size !== left.length) {
    return false;
  }
  if (Array.isArray(right) && rightSet.size !== right.length) {
    return false;
  }
  if (leftSet.size !== rightSet.size) {
    return false;
  }

  for (const value of leftSet) {
    if (!rightSet.has(value)) {
      return false;
    }
  }

  return true;
}
