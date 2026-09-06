import { DraftUnitSchema, type DraftUnit } from "../domain/draftUnit";
import {
  ManuscriptSchema,
  collectPlanEntries,
  type Manuscript,
  type ManuscriptChild,
  type ManuscriptLeaf,
} from "../domain/manuscript";

export type ManuscriptGranularityResult = {
  manuscript: Manuscript;
  units: DraftUnit[];
  unitIds: string[];
};

export function splitManuscriptUnit(
  manuscript: Manuscript,
  units: DraftUnit[],
  unitId: string
): ManuscriptGranularityResult {
  const unit = requireReplaceableUnit(manuscript, units, unitId);
  const paragraphs = unit.content.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  if (paragraphs.length < 2) {
    throw new Error("Cette unité ne contient pas plusieurs paragraphes à scinder.");
  }
  const replacements = paragraphs.map((paragraph) =>
    replacementUnit(unit, paragraph, "paragraph", Math.max(1, Math.ceil(unit.targetWordCount / paragraphs.length)))
  );
  const tree = replaceLeaf(manuscript.tree, unit, replacements.map(toLeaf));
  if (!tree.replaced) throw new Error("Cette unité ne fait pas partie du manuscrit actif.");

  return {
    manuscript: nextManuscript(manuscript, tree.children),
    units: replaceUnits(units, [unit.id], replacements),
    unitIds: replacements.map((item) => item.id),
  };
}

export function mergeManuscriptUnitWithNext(
  manuscript: Manuscript,
  units: DraftUnit[],
  unitId: string
): ManuscriptGranularityResult {
  const first = requireReplaceableUnit(manuscript, units, unitId);
  const sibling = followingLeaf(manuscript.tree, first);
  if (!sibling) throw new Error("Cette unité n’a pas de voisine à fusionner dans sa section.");
  const second = requireReplaceableUnit(manuscript, units, sibling.unitId);
  if (sibling.version !== second.version) throw new Error("La version de l’unité voisine n’est plus à jour.");

  const merged = replacementUnit(
    first,
    [first.content.trim(), second.content.trim()].filter(Boolean).join("\n\n"),
    first.granularity === "paragraph" && second.granularity === "paragraph" ? "section" : first.granularity,
    first.targetWordCount + second.targetWordCount
  );
  const tree = replaceAdjacentLeaves(manuscript.tree, first, second, toLeaf(merged));
  if (!tree.replaced) throw new Error("Ces unités ne sont pas adjacentes dans le manuscrit actif.");

  return {
    manuscript: nextManuscript(manuscript, tree.children),
    units: replaceUnits(units, [first.id, second.id], [merged]),
    unitIds: [merged.id],
  };
}

function requireReplaceableUnit(manuscript: Manuscript, units: DraftUnit[], unitId: string): DraftUnit {
  const unit = units.find((item) => item.id === unitId);
  if (!unit) throw new Error("Cette unité n’existe plus.");
  if (
    unit.status !== "drafting" ||
    unit.claimIds.length > 0 ||
    unit.citationUses.length > 0 ||
    unit.appliedDecisionIds.length > 0 ||
    unit.appliedArticulationIds.length > 0 ||
    unit.transformationTraceIds.length > 0 ||
    unit.editorialPlanId ||
    unit.activeRevisionBriefId ||
    unit.scores ||
    unit.publishedAt ||
    collectPlanEntries(manuscript.tree).some(
      (entry) => entry.unitId === unit.id && entry.unitVersion === unit.version
    )
  ) {
    throw new Error("Cette unité a déjà des références éditoriales : sa granularité ne peut plus être modifiée automatiquement.");
  }
  return unit;
}

function replacementUnit(
  source: DraftUnit,
  content: string,
  granularity: DraftUnit["granularity"],
  targetWordCount: number
): DraftUnit {
  const now = new Date().toISOString();
  return DraftUnitSchema.parse({
    ...source,
    id: crypto.randomUUID(),
    granularity,
    targetWordCount,
    content,
    version: 1,
    createdAt: now,
    updatedAt: now,
  });
}

function nextManuscript(manuscript: Manuscript, tree: ManuscriptChild[]): Manuscript {
  return ManuscriptSchema.parse({ ...manuscript, tree, updatedAt: new Date().toISOString() });
}

function toLeaf(unit: DraftUnit): ManuscriptLeaf {
  return { kind: "leaf", unitId: unit.id, version: unit.version };
}

function replaceUnits(units: DraftUnit[], removedIds: string[], replacements: DraftUnit[]): DraftUnit[] {
  const removed = new Set(removedIds);
  const first = removedIds[0];
  return units.flatMap((unit) => {
    if (unit.id === first) return replacements;
    return removed.has(unit.id) ? [] : [unit];
  });
}

function replaceLeaf(
  children: ManuscriptChild[],
  target: DraftUnit,
  replacements: ManuscriptLeaf[]
): { children: ManuscriptChild[]; replaced: boolean } {
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    if (child.kind === "leaf" && child.unitId === target.id && child.version === target.version) {
      return { children: [...children.slice(0, index), ...replacements, ...children.slice(index + 1)], replaced: true };
    }
    if (child.kind === "node") {
      const nested = replaceLeaf(child.children, target, replacements);
      if (nested.replaced) {
        return { children: [...children.slice(0, index), { ...child, children: nested.children }, ...children.slice(index + 1)], replaced: true };
      }
    }
  }
  return { children, replaced: false };
}

function followingLeaf(children: ManuscriptChild[], target: DraftUnit): ManuscriptLeaf | undefined {
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    if (child.kind === "leaf" && child.unitId === target.id && child.version === target.version) {
      const next = children[index + 1];
      return next?.kind === "leaf" ? next : undefined;
    }
    if (child.kind === "node") {
      const nested = followingLeaf(child.children, target);
      if (nested) return nested;
    }
  }
  return undefined;
}

function replaceAdjacentLeaves(
  children: ManuscriptChild[],
  first: DraftUnit,
  second: DraftUnit,
  merged: ManuscriptLeaf
): { children: ManuscriptChild[]; replaced: boolean } {
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    const next = children[index + 1];
    if (
      child.kind === "leaf" &&
      child.unitId === first.id &&
      child.version === first.version &&
      next?.kind === "leaf" &&
      next.unitId === second.id &&
      next.version === second.version
    ) {
      return { children: [...children.slice(0, index), merged, ...children.slice(index + 2)], replaced: true };
    }
    if (child.kind === "node") {
      const nested = replaceAdjacentLeaves(child.children, first, second, merged);
      if (nested.replaced) {
        return { children: [...children.slice(0, index), { ...child, children: nested.children }, ...children.slice(index + 1)], replaced: true };
      }
    }
  }
  return { children, replaced: false };
}
