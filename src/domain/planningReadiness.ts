import type { PlanningBrief } from "./planningBrief.js";

export interface PlanningReadinessContext {
  /** Whether the scope's role relative to its parent is understood. */
  parentRoleKnown?: boolean;
  /** Number of retrieved passages currently relevant to this scope. */
  relevantPassageCount?: number;
  /** Author choices that materially affect structure or meaning. */
  openAuthorDecisions?: string[];
  /** Documentary gaps that block stabilisation of this scope, not merely local claims. */
  blockingSourceGaps?: string[];
  /** Only set when a decomposition is actually being considered. */
  canJustifyDecomposition?: boolean;
}

export interface PlanningReadinessAssessment {
  ready: boolean;
  reasons: string[];
  authorDecisionNeeded: boolean;
  blockedBySources: boolean;
}

/**
 * Derived planning maturity. Nothing here is persisted: the same brief and
 * context always produce the same assessment.
 */
export function assessPlanningReadiness(
  brief: PlanningBrief,
  context: PlanningReadinessContext = {}
): PlanningReadinessAssessment {
  const reasons: string[] = [];
  const openAuthorDecisions = context.openAuthorDecisions ?? [];
  const blockingSourceGaps = context.blockingSourceGaps ?? [];
  const hasDocumentaryMaterial =
    brief.sourceRefs.length > 0 || (context.relevantPassageCount ?? 0) > 0;
  const hasLiveHypothesis = brief.hypotheses.some(
    (hypothesis) => hypothesis.status !== "rejected"
  );

  if (brief.question.trim().length === 0) {
    reasons.push("planning question is not defined");
  }

  if (brief.scopeRef.kind !== "manuscript" && context.parentRoleKnown === false) {
    reasons.push("scope role in its parent is not understood");
  }

  if (!hasDocumentaryMaterial) {
    reasons.push("no documentary material is currently available for this scope");
  }

  if (!hasLiveHypothesis) {
    reasons.push("no live hypothesis or tension is identified");
  }

  if (openAuthorDecisions.length > 0) {
    reasons.push(`author decision required: ${openAuthorDecisions.join("; ")}`);
  }

  if (blockingSourceGaps.length > 0) {
    reasons.push(`blocking documentary gap: ${blockingSourceGaps.join("; ")}`);
  }

  if (context.canJustifyDecomposition === false) {
    reasons.push("proposed decomposition cannot yet be justified");
  }

  const authorDecisionNeeded = openAuthorDecisions.length > 0;
  const blockedBySources = !hasDocumentaryMaterial || blockingSourceGaps.length > 0;

  return {
    ready: reasons.length === 0,
    reasons,
    authorDecisionNeeded,
    blockedBySources,
  };
}

export type PlanningQuestionImpact =
  | "structure"
  | "scope_meaning"
  | "hypothesis"
  | "documentary_dependency"
  | "author_decision";

/** Temporary candidate produced by planning logic; never persisted as a session. */
export interface PlanningQuestionCandidate {
  id: string;
  prompt: string;
  impact: PlanningQuestionImpact;
  /** False means the answer would not materially change planning. */
  wouldChangePlanning: boolean;
}

export interface PlanningGrillPolicy {
  maxRounds: 2 | 3;
  maxQuestionsPerRound: 1 | 2 | 3;
}

export const DEFAULT_PLANNING_GRILL_POLICY: PlanningGrillPolicy = {
  maxRounds: 2,
  maxQuestionsPerRound: 3,
};

/**
 * Selects only materially discriminating questions within a strict round and
 * question budget. The caller owns the current round; no conversation state is
 * stored here.
 */
export function selectPlanningGrillQuestions(
  candidates: PlanningQuestionCandidate[],
  round: number,
  policy: PlanningGrillPolicy = DEFAULT_PLANNING_GRILL_POLICY
): PlanningQuestionCandidate[] {
  if (!Number.isInteger(round) || round < 0) {
    throw new Error("planning grill round must be a non-negative integer");
  }
  if (round >= policy.maxRounds) return [];

  const seenIds = new Set<string>();
  const selected: PlanningQuestionCandidate[] = [];

  for (const candidate of candidates) {
    if (!candidate.wouldChangePlanning || seenIds.has(candidate.id)) continue;
    seenIds.add(candidate.id);
    selected.push(candidate);
    if (selected.length === policy.maxQuestionsPerRound) break;
  }

  return selected;
}

export function isPlanningGrillExhausted(
  round: number,
  policy: PlanningGrillPolicy = DEFAULT_PLANNING_GRILL_POLICY
): boolean {
  if (!Number.isInteger(round) || round < 0) {
    throw new Error("planning grill round must be a non-negative integer");
  }
  return round >= policy.maxRounds;
}

/**
 * Closure view used after the budget is exhausted. It deliberately keeps the
 * best current brief intact and exposes unresolved questions instead of
 * inventing answers or opening another round implicitly.
 */
export function closePlanningGrill(
  brief: PlanningBrief,
  unresolvedCandidates: PlanningQuestionCandidate[],
  round: number,
  policy: PlanningGrillPolicy = DEFAULT_PLANNING_GRILL_POLICY
): { brief: PlanningBrief; exhausted: boolean; unresolvedQuestions: string[] } {
  const exhausted = isPlanningGrillExhausted(round, policy);
  return {
    brief,
    exhausted,
    unresolvedQuestions: exhausted
      ? unresolvedCandidates
          .filter((candidate) => candidate.wouldChangePlanning)
          .map((candidate) => candidate.prompt)
      : [],
  };
}
