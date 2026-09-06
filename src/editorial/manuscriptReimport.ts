import { createDraftUnit, type DraftUnit } from "../domain/draftUnit";
import {
  createManuscriptLeaf,
  createManuscriptNode,
  ManuscriptSchema,
  type Manuscript,
  type ManuscriptChild,
  type ManuscriptNode,
} from "../domain/manuscript";
import type { ManuscriptImportAnnotation, ManuscriptImportPreview, ManuscriptImportSection } from "../ingestion/manuscriptImport";

export type ManuscriptReimportAction = {
  sectionId: string;
  action: "add" | "replace" | "ignore";
  targetSectionId?: string;
};

export type ManuscriptReimportComparison = {
  manuscriptUpdatedAt: string;
  targets: Array<{ id: string; title: string; unitCount: number }>;
  suggestions: Array<{
    sectionId: string;
    action: "add" | "replace";
    targetSectionId?: string;
  }>;
};

export type ManuscriptReimportResult = {
  manuscript: Manuscript;
  units: DraftUnit[];
  replacedUnitIds: string[];
  unitIds: string[];
};

/**
 * A comparison is deliberately just a guide. Confirmation still requires one
 * explicit action per incoming section, so a suggestion can never overwrite
 * an existing passage by itself.
 */
export function compareManuscriptReimport(
  manuscript: Manuscript,
  preview: ManuscriptImportPreview
): ManuscriptReimportComparison {
  const targets = collectTargets(manuscript.tree);

  return {
    manuscriptUpdatedAt: manuscript.updatedAt,
    targets: targets.map(({ node, leaves }) => ({ id: node.id, title: node.title, unitCount: leaves.length })),
    suggestions: preview.sections.map((section) => {
      const matches = targets.filter(({ node }) => normalizeTitle(node.title) === normalizeTitle(section.title));
      return matches.length === 1
        ? { sectionId: section.id, action: "replace" as const, targetSectionId: matches[0].node.id }
        : { sectionId: section.id, action: "add" as const };
    }),
  };
}

/**
 * Replaces only sections selected by the author. Existing node ids stay in
 * place, which keeps the manuscript structure coherent even after a section
 * was manually split into paragraph units.
 */
export function applyManuscriptReimport(
  manuscript: Manuscript,
  units: DraftUnit[],
  preview: ManuscriptImportPreview,
  actions: ManuscriptReimportAction[]
): ManuscriptReimportResult {
  assertCompleteActions(preview, actions);
  const targets = new Map(collectTargets(manuscript.tree).map((target) => [target.node.id, target]));
  const chosen = new Map(actions.map((action) => [action.sectionId, action]));
  const replacedTargetIds = new Set<string>();

  for (const action of actions) {
    if (action.action !== "replace") continue;
    if (!action.targetSectionId) throw new Error("Choisissez la section à remplacer.");
    if (replacedTargetIds.has(action.targetSectionId)) {
      throw new Error("Une section existante ne peut être remplacée qu’une fois.");
    }
    const target = targets.get(action.targetSectionId);
    if (!target) throw new Error("La section à remplacer n’existe plus. Préparez un nouvel aperçu.");
    assertReplaceable(target, units, manuscript);
    replacedTargetIds.add(target.node.id);
  }

  const replacements = new Map<string, { unit: DraftUnit; leafUnitIds: string[]; section: ManuscriptImportSection }>();
  const additions = new Map<string, { node: ManuscriptNode; unit: DraftUnit; parentIncomingId?: string }>();

  for (const section of preview.sections) {
    const action = chosen.get(section.id)!;
    if (action.action === "ignore") continue;

    if (action.action === "replace") {
      const target = targets.get(action.targetSectionId!)!;
      const unit = importedUnit(manuscript.projectId, section, target.node.id);
      replacements.set(target.node.id, { unit, leafUnitIds: target.leaves.map((leaf) => leaf.unitId), section });
      continue;
    }

    const node = createManuscriptNode({ id: crypto.randomUUID(), title: section.title, notes: importedNotes(section.annotations) });
    const unit = importedUnit(manuscript.projectId, section, node.id);
    node.children.push(createManuscriptLeaf(unit.id, unit.version));
    additions.set(section.id, { node, unit, parentIncomingId: parentSectionId(preview.sections, section.id) });
  }

  const additionsByExistingTarget = new Map<string, ManuscriptNode[]>();
  const rootAdditions: ManuscriptNode[] = [];
  for (const addition of additions.values()) {
    const parentAction = addition.parentIncomingId ? chosen.get(addition.parentIncomingId) : undefined;
    if (parentAction?.action === "add" && additions.has(parentAction.sectionId)) continue;
    if (parentAction?.action === "replace" && parentAction.targetSectionId) {
      const siblingAdditions = additionsByExistingTarget.get(parentAction.targetSectionId) ?? [];
      siblingAdditions.push(addition.node);
      additionsByExistingTarget.set(parentAction.targetSectionId, siblingAdditions);
    } else {
      rootAdditions.push(addition.node);
    }
  }

  for (const addition of additions.values()) {
    const parentId = addition.parentIncomingId;
    if (!parentId || !additions.has(parentId)) continue;
    additions.get(parentId)!.node.children.push(addition.node);
  }

  const tree = rewriteTree(manuscript.tree, replacements, additionsByExistingTarget);
  tree.push(...rootAdditions);
  const replacementByOldUnitId = new Map<string, DraftUnit>();
  const removedUnitIds = new Set<string>();
  for (const replacement of replacements.values()) {
    replacement.leafUnitIds.forEach((unitId, index) => {
      if (index === 0) replacementByOldUnitId.set(unitId, replacement.unit);
      else removedUnitIds.add(unitId);
    });
  }
  const nextUnits = units.flatMap((unit) => {
    const replacement = replacementByOldUnitId.get(unit.id);
    if (replacement) return [replacement];
    return removedUnitIds.has(unit.id) ? [] : [unit];
  });
  for (const addition of additions.values()) nextUnits.push(addition.unit);

  const resultManuscript = ManuscriptSchema.parse({
    ...manuscript,
    tree,
    updatedAt: new Date().toISOString(),
  });
  const replacedUnitIds = [...replacements.values()].flatMap((replacement) => replacement.leafUnitIds);
  const unitIds = [
    ...replacements.values()].map((replacement) => replacement.unit.id).concat([...additions.values()].map((addition) => addition.unit.id));

  return { manuscript: resultManuscript, units: nextUnits, replacedUnitIds, unitIds };
}

function collectTargets(children: ManuscriptChild[]): Array<{ node: ManuscriptNode; leaves: Array<Extract<ManuscriptChild, { kind: "leaf" }>> }> {
  const targets: Array<{ node: ManuscriptNode; leaves: Array<Extract<ManuscriptChild, { kind: "leaf" }>> }> = [];
  for (const child of children) {
    if (child.kind !== "node") continue;
    const leaves = child.children.filter((item): item is Extract<ManuscriptChild, { kind: "leaf" }> => item.kind === "leaf");
    if (leaves.length > 0) targets.push({ node: child, leaves });
    targets.push(...collectTargets(child.children));
  }
  return targets;
}

function assertCompleteActions(preview: ManuscriptImportPreview, actions: ManuscriptReimportAction[]) {
  if (actions.length !== preview.sections.length || new Set(actions.map((action) => action.sectionId)).size !== actions.length) {
    throw new Error("Choisissez une action pour chaque section importée.");
  }
  const incomingIds = new Set(preview.sections.map((section) => section.id));
  if (actions.some((action) => !incomingIds.has(action.sectionId))) {
    throw new Error("L’aperçu a changé. Préparez-le à nouveau avant de réimporter.");
  }
}

function assertReplaceable(
  target: { node: ManuscriptNode; leaves: Array<Extract<ManuscriptChild, { kind: "leaf" }>> },
  units: DraftUnit[],
  manuscript: Manuscript
) {
  const targetUnitIds = new Set(target.leaves.map((leaf) => leaf.unitId));
  const planReferencesTarget = collectPlanUnitIds(manuscript.tree).some((unitId) => targetUnitIds.has(unitId));
  if (planReferencesTarget) {
    throw new Error("Cette section est déjà liée à un plan : elle ne peut pas être remplacée par réimportation.");
  }
  for (const leaf of target.leaves) {
    const unit = units.find((candidate) => candidate.id === leaf.unitId && candidate.version === leaf.version);
    if (!unit) throw new Error("Une unité de la section à remplacer est introuvable.");
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
      unit.publishedAt
    ) {
      throw new Error("Cette section contient déjà un travail éditorial : conservez-la ou réimportez dans une nouvelle section.");
    }
  }
}

function rewriteTree(
  children: ManuscriptChild[],
  replacements: Map<string, { unit: DraftUnit; leafUnitIds: string[]; section: ManuscriptImportSection }>,
  additionsByExistingTarget: Map<string, ManuscriptNode[]>
): ManuscriptChild[] {
  return children.map((child) => {
    if (child.kind === "leaf") return child;
    const replacement = replacements.get(child.id);
    const rewrittenChildren = rewriteTree(child.children, replacements, additionsByExistingTarget);
    const childrenWithoutReplacedLeaves = replacement
      ? rewrittenChildren.filter((item) => item.kind !== "leaf")
      : rewrittenChildren;
    const ownLeaves = replacement ? [createManuscriptLeaf(replacement.unit.id, replacement.unit.version)] : [];
    const additions = additionsByExistingTarget.get(child.id) ?? [];
    return {
      ...child,
      ...(replacement ? { title: replacement.section.title, notes: [...(child.notes ?? []), ...importedNotes(replacement.section.annotations)] } : {}),
      children: [...ownLeaves, ...childrenWithoutReplacedLeaves, ...additions],
    };
  });
}

function importedUnit(projectId: string, section: ManuscriptImportSection, sectionId: string): DraftUnit {
  return createDraftUnit({
    projectId,
    granularity: "section",
    thesis: section.title,
    contextInPlan: { section: sectionId },
    content: section.content,
    evidencePack: { sourceIds: [], keyCitations: [], supportingClaimIds: [], objections: [] },
  });
}

function importedNotes(annotations: ManuscriptImportAnnotation[]) {
  return annotations.map((annotation) => ({
    kind: "human" as const,
    text:
      annotation.kind === "link"
        ? `Import — lien : ${annotation.label} (${annotation.url})`
        : `Import — commentaire : ${annotation.content}`,
    createdAt: new Date().toISOString(),
  }));
}

function parentSectionId(sections: ManuscriptImportSection[], sectionId: string): string | undefined {
  const index = sections.findIndex((section) => section.id === sectionId);
  if (index < 1) return undefined;
  const level = sections[index].level;
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (sections[cursor].level < level) return sections[cursor].id;
  }
  return undefined;
}

function collectPlanUnitIds(children: ManuscriptChild[]): string[] {
  return children.flatMap((child) =>
    child.kind === "node"
      ? [...(child.plan ?? []).flatMap((entry) => (entry.unitId ? [entry.unitId] : [])), ...collectPlanUnitIds(child.children)]
      : []
  );
}

function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}
