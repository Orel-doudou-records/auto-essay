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

  const leafVersions: number[] = [];
  const planVersions: Array<number | undefined> = [];

  const inspect = (child: ManuscriptChild): void => {
    if (child.kind === "leaf") {
      if (child.unitId === unitId) leafVersions.push(child.version);
      return;
    }
    for (const entry of child.plan ?? []) {
      if (entry.unitId === unitId) planVersions.push(entry.unitVersion);
    }
    for (const nested of child.children) inspect(nested);
  };
  for (const child of manuscript.tree) inspect(child);

  if (leafVersions.length !== 1 || planVersions.length > 1) {
    throw new Error(
      `ambiguous manuscript references for unit '${unitId}': ${leafVersions.length} leaves, ${planVersions.length} plan entries`
    );
  }
  if (leafVersions[0] !== expectedVersion) {
    throw new Error(
      `manuscript unit '${unitId}' expected version ${expectedVersion}, found leaf version ${String(leafVersions[0])}`
    );
  }
  if (planVersions.length === 1 && planVersions[0] !== expectedVersion) {
    throw new Error(
      `manuscript unit '${unitId}' expected version ${expectedVersion}, found plan version ${String(planVersions[0])}`
    );
  }

  const advance = (child: ManuscriptChild): ManuscriptChild => {
    if (child.kind === "leaf") {
      return child.unitId === unitId ? { ...child, version: nextVersion } : child;
    }

    const node: ManuscriptNode = {
      ...child,
      ...(child.plan === undefined
        ? {}
        : {
            plan: child.plan.map((entry) =>
              entry.unitId === unitId ? { ...entry, unitVersion: nextVersion } : entry
            ),
          }),
      children: child.children.map(advance),
    };
    return node;
  };

  return ManuscriptSchema.parse({
    ...manuscript,
    tree: manuscript.tree.map(advance),
  });
}
