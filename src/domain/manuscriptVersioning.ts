import {
  ManuscriptSchema,
  type Manuscript,
  type ManuscriptChild,
  type ManuscriptNode,
} from "./manuscript.js";

/**
 * Advance the one mounted literary paragraph represented by a DraftUnit and
 * its optional linked PlanEntry. The function is pure and fails before
 * returning any state when the AutoEssay manuscript cannot identify one
 * unambiguous literary paragraph at the expected version.
 */
export function advanceManuscriptUnitVersion(
  manuscript: Manuscript,
  unitId: string,
  expectedVersion: number,
  nextVersion: number
): Manuscript {
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    throw new Error("expected manuscript unit version must be a positive integer");
  }
  if (nextVersion !== expectedVersion + 1) {
    throw new Error("next manuscript unit version must advance exactly once");
  }

  let leafMatches = 0;
  let planMatches = 0;

  const visit = (child: ManuscriptChild): ManuscriptChild => {
    if (child.kind === "leaf") {
      if (child.unitId !== unitId) return child;
      leafMatches += 1;
      if (child.version !== expectedVersion) {
        throw new Error(
          `manuscript unit '${unitId}' expected version ${expectedVersion}, found leaf version ${child.version}`
        );
      }
      return { ...child, version: nextVersion };
    }

    const node: ManuscriptNode = {
      ...child,
      ...(child.plan === undefined
        ? {}
        : {
            plan: child.plan.map((entry) => {
              if (entry.unitId !== unitId) return entry;
              planMatches += 1;
              if (entry.unitVersion !== expectedVersion) {
                throw new Error(
                  `manuscript unit '${unitId}' expected version ${expectedVersion}, found plan version ${String(entry.unitVersion)}`
                );
              }
              return { ...entry, unitVersion: nextVersion };
            }),
          }),
      children: child.children.map(visit),
    };
    return node;
  };

  const tree = manuscript.tree.map(visit);
  if (leafMatches !== 1 || planMatches > 1) {
    throw new Error(
      `ambiguous manuscript references for unit '${unitId}': ${leafMatches} leaves, ${planMatches} plan entries`
    );
  }

  return ManuscriptSchema.parse({ ...manuscript, tree });
}
