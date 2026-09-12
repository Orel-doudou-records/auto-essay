import { z } from "zod";
import type { EditorialPlan } from "../domain/editorialPlan.js";
import type { Manuscript, ManuscriptChild } from "../domain/manuscript.js";
import type { PlanningBrief } from "../domain/planningBrief.js";
import type { StructuredModelClient } from "../evaluation/evaluateEssay.js";
import { createDiffractiveReader } from "./diffractiveReader.js";
import type {
  BookBibliographyInput,
  BookPartInput,
  ExistingCutInput,
} from "./diffractiveReader.js";
import type { PlanningCompilationTrace } from "./planningEditorialPlanCompiler.js";
import { projectBookPlan } from "./projectBookState.js";

export const PlanningImpactKindSchema = z.enum([
  "unaffected",
  "review_recommended",
  "editorial_plan_stale",
  "structural_conflict",
  "source_gap_changed",
]);
export type PlanningImpactKind = z.infer<typeof PlanningImpactKindSchema>;

export interface CompiledPlanningScope {
  plan: EditorialPlan;
  trace: PlanningCompilationTrace;
}

export interface PlanningChangeImpact {
  scopeId: string;
  kind: PlanningImpactKind;
  reason: string;
  consequenceChain: string[];
  editorialPlanId?: string;
}

export interface ReviewPlanningChangeInput {
  previousBrief: PlanningBrief;
  nextBrief: PlanningBrief;
  manuscript: Manuscript;
  compiledScopes?: CompiledPlanningScope[];
  bookParts?: BookPartInput[];
  existingCuts?: ExistingCutInput[];
  bookBibliography?: BookBibliographyInput;
}

export interface PlanningChangeReview {
  readingId: string;
  verdict: string;
  impacts: PlanningChangeImpact[];
}

/**
 * Advisory Plan V2 change review. Diffract identifies semantic consequences;
 * this function only classifies already-observable downstream states. It does
 * not mutate, regenerate, or recursively propagate anything.
 */
export async function reviewPlanningChangeImpacts(
  input: ReviewPlanningChangeInput,
  client: StructuredModelClient
): Promise<PlanningChangeReview> {
  if (input.previousBrief.projectId !== input.nextBrief.projectId) {
    throw new Error("planning change review requires briefs from the same project");
  }
  if (
    input.nextBrief.version <= input.previousBrief.version ||
    input.nextBrief.supersedesBriefId !== input.previousBrief.id
  ) {
    throw new Error("next planning brief must supersede the previous brief");
  }

  const bookPlan = projectBookPlan(input.manuscript);
  const reading = await createDiffractiveReader(client).read({
    statement: buildPlanningChangeStatement(input.previousBrief, input.nextBrief),
    sourceIds: input.nextBrief.sourceRefs,
    bookPlan: bookPlan.length > 0 ? bookPlan : undefined,
    bookParts: input.bookParts,
    existingCuts: input.existingCuts,
    bookBibliography: input.bookBibliography,
  });

  const compiledScopes = input.compiledScopes ?? [];
  const impacts: PlanningChangeImpact[] = [];
  const touchedPlanIds = new Set<string>();
  const touchedScopeIds = new Set<string>();

  for (const compiled of compiledScopes) {
    const scopeId = executableScopeId(compiled.plan);
    if (!scopeExists(input.manuscript.tree, compiled.plan)) {
      impacts.push({
        scopeId,
        kind: "structural_conflict",
        editorialPlanId: compiled.plan.id,
        reason: "the executable scope no longer resolves in the current manuscript structure",
        consequenceChain: [
          `EditorialPlan ${compiled.plan.id} targets ${scopeId}`,
          "that scope is absent from the current manuscript tree",
          "author review is required before any further execution",
        ],
      });
      touchedPlanIds.add(compiled.plan.id);
      touchedScopeIds.add(scopeId);
      continue;
    }

    if (
      compiled.trace.briefId === input.previousBrief.id &&
      compiled.trace.briefVersion === input.previousBrief.version
    ) {
      impacts.push({
        scopeId,
        kind: "editorial_plan_stale",
        editorialPlanId: compiled.plan.id,
        reason: "the EditorialPlan was compiled from the superseded PlanningBrief",
        consequenceChain: [
          `PlanningBrief ${input.previousBrief.id} v${input.previousBrief.version} was compiled into EditorialPlan ${compiled.plan.id}`,
          `PlanningBrief ${input.nextBrief.id} v${input.nextBrief.version} now supersedes it`,
          "the existing text is not rewritten, but the execution plan requires revalidation",
        ],
      });
      touchedPlanIds.add(compiled.plan.id);
      touchedScopeIds.add(scopeId);
    }
  }

  for (const planImpact of reading.planImpacts) {
    const scopeId = planImpact.entryId ?? planImpact.partId;
    const compiled = compiledScopes.find(({ plan }) => planTargets(plan, planImpact.partId, planImpact.entryId ?? undefined));
    if (compiled && !touchedPlanIds.has(compiled.plan.id)) {
      impacts.push({
        scopeId,
        kind: "editorial_plan_stale",
        editorialPlanId: compiled.plan.id,
        reason: planImpact.impact,
        consequenceChain: [
          `planning change ${input.previousBrief.id} -> ${input.nextBrief.id}`,
          `Diffract identifies an impact on ${scopeId}: ${planImpact.impact}`,
          `EditorialPlan ${compiled.plan.id} targets that scope`,
          "revalidate the plan; do not regenerate or rewrite automatically",
        ],
      });
      touchedPlanIds.add(compiled.plan.id);
      touchedScopeIds.add(scopeId);
    } else if (!touchedScopeIds.has(scopeId)) {
      impacts.push({
        scopeId,
        kind: "review_recommended",
        reason: planImpact.impact,
        consequenceChain: [
          `planning change ${input.previousBrief.id} -> ${input.nextBrief.id}`,
          `Diffract identifies a distant plan impact on ${scopeId}`,
          planImpact.impact,
        ],
      });
      touchedScopeIds.add(scopeId);
    }
  }

  for (const bibliographyImpact of reading.bibliographyImpacts) {
    const scopeId = bibliographyImpact.scopeId;
    const compiled = compiledScopes.find(({ plan }) => executableScopeId(plan) === scopeId);
    impacts.push({
      scopeId,
      kind: "source_gap_changed",
      editorialPlanId: compiled?.plan.id,
      reason: bibliographyImpact.impact,
      consequenceChain: [
        `source ${bibliographyImpact.sourceId} is ${bibliographyImpact.kind} for scope ${scopeId}`,
        bibliographyImpact.impact,
        "documentary assumptions require targeted revalidation only",
      ],
    });
    if (compiled) touchedPlanIds.add(compiled.plan.id);
    touchedScopeIds.add(scopeId);
  }

  for (const compiled of compiledScopes) {
    if (touchedPlanIds.has(compiled.plan.id)) continue;
    const scopeId = executableScopeId(compiled.plan);
    impacts.push({
      scopeId,
      kind: "unaffected",
      editorialPlanId: compiled.plan.id,
      reason: "no structural, documentary, or diffractive impact targets this executable scope",
      consequenceChain: [
        `EditorialPlan ${compiled.plan.id} remains outside the identified consequence set`,
      ],
    });
  }

  return { readingId: reading.id, verdict: reading.verdict, impacts };
}

function buildPlanningChangeStatement(previous: PlanningBrief, next: PlanningBrief): string {
  return [
    "Changement validé de PlanningBrief à diffracter dans le livre en cours.",
    `Avant (${previous.id} v${previous.version}): ${JSON.stringify(compactBrief(previous))}`,
    `Après (${next.id} v${next.version}): ${JSON.stringify(compactBrief(next))}`,
    "Identifier seulement les conséquences réelles sur les scopes distants, le plan et les dépendances documentaires. Ne proposer aucune réécriture automatique.",
  ].join("\n");
}

function compactBrief(brief: PlanningBrief) {
  return {
    scopeRef: brief.scopeRef,
    question: brief.question,
    angleOrFunction: brief.angleOrFunction,
    hypotheses: brief.hypotheses,
    gaps: brief.gaps,
    constraints: brief.constraints,
    sourceRefs: brief.sourceRefs,
  };
}

function executableScopeId(plan: EditorialPlan): string {
  return plan.scope.paragraphId ?? plan.scope.sectionId ?? plan.scope.projectId;
}

function planTargets(plan: EditorialPlan, partId: string, entryId?: string): boolean {
  if (entryId && plan.scope.paragraphId === entryId) return true;
  return plan.scope.sectionId === partId;
}

function scopeExists(tree: ManuscriptChild[], plan: EditorialPlan): boolean {
  if (plan.scope.level === "project") return true;
  const sectionId = plan.scope.sectionId;
  if (!sectionId || !containsNode(tree, sectionId)) return false;
  if (plan.scope.level === "paragraph") {
    return Boolean(plan.scope.paragraphId && containsNode(tree, plan.scope.paragraphId));
  }
  return true;
}

function containsNode(children: ManuscriptChild[], nodeId: string): boolean {
  for (const child of children) {
    if (child.kind !== "node") continue;
    if (child.id === nodeId || containsNode(child.children, nodeId)) return true;
  }
  return false;
}
