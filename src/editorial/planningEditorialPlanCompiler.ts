import type { EditorialScopeInput } from "../domain/contentRelation.js";
import {
  createEditorialPlan,
  type EditorialPlan,
  type EditorialPlanStatus,
} from "../domain/editorialPlan.js";
import type { EditorialDecision } from "../domain/editorialDecision.js";
import type {
  ArticulationEffectsInput,
  PlannedStylisticOperationInput,
} from "../domain/contentStyleArticulation.js";
import type { PlanningBrief } from "../domain/planningBrief.js";
import {
  assessPlanningReadiness,
  type PlanningReadinessContext,
} from "../domain/planningReadiness.js";

export interface PlanningPassageProvenance {
  passageId: string;
  sourceId: string;
}

export interface PlanningCompilationTrace {
  briefId: string;
  briefVersion: number;
  sourceRefs: string[];
  passageProvenance: PlanningPassageProvenance[];
  hypotheses: Array<{
    statement: string;
    status: PlanningBrief["hypotheses"][number]["status"];
    sourceRefs: string[];
  }>;
  nonBlockingGaps: Array<{
    description: string;
    consequence: string;
    neededEvidence?: string;
  }>;
}

export interface PlanningEditorialExecutionInput {
  unitId: string;
  unitVersion: number;
  scope: EditorialScopeInput;
  decisions: EditorialDecision[];
  argumentativeFunction?: string;
  claimIds?: string[];
  evidenceIds?: string[];
  sourceRelationIds?: string[];
  contentOperations: string[];
  stylisticOperations: PlannedStylisticOperationInput[];
  intendedEffects: ArticulationEffectsInput;
  inheritedConstraints?: string[];
  status?: EditorialPlanStatus;
}

export interface CompilePlanningScopeInput {
  brief: PlanningBrief;
  readinessContext?: PlanningReadinessContext;
  passageProvenance?: PlanningPassageProvenance[];
  execution: PlanningEditorialExecutionInput;
}

export type CompilePlanningScopeResult =
  | {
      ok: true;
      plan: EditorialPlan;
      trace: PlanningCompilationTrace;
    }
  | {
      ok: false;
      reasons: string[];
    };

/**
 * Thin Plan V2 -> EditorialPlan adapter.
 *
 * Planning semantics stay upstream. Only fields already consumed by
 * EditorialPlan are projected; the rest remains in a transient trace so this
 * function does not create a second execution-plan model.
 */
export function compilePlanningScopeToEditorialPlan(
  input: CompilePlanningScopeInput
): CompilePlanningScopeResult {
  const readiness = assessPlanningReadiness(
    input.brief,
    input.readinessContext ?? {}
  );
  if (!readiness.ready) {
    return { ok: false, reasons: readiness.reasons };
  }

  const argumentativeFunction =
    input.brief.angleOrFunction?.trim() ||
    input.execution.argumentativeFunction?.trim();
  if (!argumentativeFunction) {
    return {
      ok: false,
      reasons: [
        "no argumentative function is available for the executable editorial plan",
      ],
    };
  }

  const passageProvenance = input.passageProvenance ?? [];
  const declaredSources = new Set(input.brief.sourceRefs);
  const detachedPassage = passageProvenance.find(
    (passage) => !declaredSources.has(passage.sourceId)
  );
  if (detachedPassage) {
    return {
      ok: false,
      reasons: [
        `passage ${detachedPassage.passageId} references source ${detachedPassage.sourceId} outside the planning brief`,
      ],
    };
  }

  const plan = createEditorialPlan({
    unitId: input.execution.unitId,
    unitVersion: input.execution.unitVersion,
    scope: input.execution.scope,
    argumentativeFunction,
    decisions: input.execution.decisions,
    claimIds: input.execution.claimIds,
    evidenceIds: input.execution.evidenceIds,
    sourceRelationIds: input.execution.sourceRelationIds,
    contentOperations: input.execution.contentOperations,
    stylisticOperations: input.execution.stylisticOperations,
    intendedEffects: input.execution.intendedEffects,
    invariants: [
      ...new Set([
        ...input.brief.constraints,
        ...(input.execution.inheritedConstraints ?? []),
      ]),
    ],
    status: input.execution.status,
  });

  return {
    ok: true,
    plan,
    trace: {
      briefId: input.brief.id,
      briefVersion: input.brief.version,
      sourceRefs: [...input.brief.sourceRefs],
      passageProvenance: passageProvenance.map((passage) => ({ ...passage })),
      hypotheses: input.brief.hypotheses.map((hypothesis) => ({
        statement: hypothesis.statement,
        status: hypothesis.status,
        sourceRefs: [...hypothesis.sourceRefs],
      })),
      nonBlockingGaps: input.brief.gaps.map((gap) => ({ ...gap })),
    },
  };
}
