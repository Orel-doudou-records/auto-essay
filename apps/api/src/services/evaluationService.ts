import {
  assessIntegratedEvaluationReadiness,
  createIntegratedEvaluationHistoryEntry,
  DEFAULT_JUDGE_ROUTING_POLICY,
  EssayEvaluator,
  RevisionBriefGenerator,
  selectJudgeAssignment,
  type DraftUnit,
  type JudgeRoutingPolicy,
} from "@auto-essay/core";
import type { ModelClientFactory } from "../llm/client.js";
import { StructuredClientAdapter } from "../llm/structuredAdapter.js";
import { getUnit, updateUnit } from "./unitStore.js";
import { getWorkspace } from "./editorialWorkspaceStore.js";
import { getIntegratedEvaluationContext } from "./integratedEvaluationContextStore.js";
import {
  appendIntegratedEvaluationHistory,
  listIntegratedEvaluationHistory,
} from "./integratedEvaluationHistoryStore.js";
import { listSources } from "./sourceStore.js";

export function selectEvaluationJudgeAssignments(
  judgeRoutingPolicy: JudgeRoutingPolicy = DEFAULT_JUDGE_ROUTING_POLICY
) {
  return {
    documentary: selectJudgeAssignment(judgeRoutingPolicy, "documentary_evaluation"),
    editorial: selectJudgeAssignment(judgeRoutingPolicy, "editorial_effect_evaluation"),
  };
}

export async function getIntegratedEvaluationReadiness(
  projectId: string,
  unitId: string
) {
  const unit = await getUnit(projectId, unitId);
  if (!unit) throw new Error("unit not found");

  const context = await getIntegratedEvaluationContext(projectId, unitId);
  if (!context) {
    return assessIntegratedEvaluationReadiness({ unit, decisions: [] });
  }

  const workspace = await getWorkspace(projectId);
  return assessIntegratedEvaluationReadiness({
    unit,
    decisions: workspace.decisions,
    context,
  });
}

export async function evaluateIntegratedUnit(
  projectId: string,
  unitId: string,
  modelClientFactory: ModelClientFactory,
  judgeRoutingPolicy: JudgeRoutingPolicy = DEFAULT_JUDGE_ROUTING_POLICY
) {
  const unit = await getUnit(projectId, unitId);
  if (!unit) throw new Error("unit not found");

  const context = await getIntegratedEvaluationContext(projectId, unitId);
  const workspace = context ? await getWorkspace(projectId) : undefined;
  const readiness = assessIntegratedEvaluationReadiness({
    unit,
    decisions: workspace?.decisions ?? [],
    context,
  });
  if (readiness.status !== "ready") {
    throw new Error(
      `integrated evaluation unavailable: ${readiness.reasons
        .map((reason) => reason.code)
        .join(", ")}`
    );
  }

  const assignments = selectEvaluationJudgeAssignments(judgeRoutingPolicy);
  const sources = await listSources(projectId);
  const client = await modelClientFactory();
  const structured = new StructuredClientAdapter(client);
  const evaluator = new EssayEvaluator(
    structured,
    assignments.documentary.judge.model,
    judgeRoutingPolicy
  );
  const integratedEvaluation = await evaluator.evaluateIntegrated({
    unit,
    sources,
    claims: [],
    editorialProjection: readiness.context.evaluatorProjection,
    transformationTraces: readiness.context.transformationTraces,
  });
  const editorialEvaluation = integratedEvaluation.editorial;
  const editorialCoherence = integratedEvaluation.gates.editorialCoherence;
  if (!editorialEvaluation || editorialCoherence === "not_assessed") {
    throw new Error("integrated evaluation requires both judge results");
  }

  const brief = new RevisionBriefGenerator().generateBrief(
    integratedEvaluation.essay,
    unit
  );
  const authorDecisions = workspace?.decisions.filter((decision) =>
    readiness.context.decisionIds.includes(decision.id)
  ) ?? [];

  await appendIntegratedEvaluationHistory(
    projectId,
    createIntegratedEvaluationHistoryEntry({
      id: crypto.randomUUID(),
      recordedAt: new Date().toISOString(),
      unitId: unit.id,
      unitVersion: unit.version,
      evaluation: integratedEvaluation.essay,
      editorialEvaluation,
      gates: {
        documentaryIntegrity: integratedEvaluation.gates.documentaryIntegrity,
        editorialCoherence,
      },
      finalVerdict: integratedEvaluation.finalVerdict,
      brief,
      assignments,
      context: readiness.context,
      authorDecisions,
    })
  );

  return {
    evaluation: integratedEvaluation.essay,
    editorialEvaluation,
    gates: {
      documentaryIntegrity: integratedEvaluation.gates.documentaryIntegrity,
      editorialCoherence,
    },
    finalVerdict: integratedEvaluation.finalVerdict,
    brief,
    assignments,
  };
}

export async function getIntegratedEvaluationHistory(
  projectId: string,
  unitId: string
) {
  const unit = await getUnit(projectId, unitId);
  if (!unit) throw new Error("unit not found");

  const history = await listIntegratedEvaluationHistory(projectId, unitId);
  if (history.length === 0) return [];

  const workspace = await getWorkspace(projectId);
  return history.map((entry) => ({
    ...entry,
    current:
      entry.unitVersion === unit.version &&
      entry.authorDecisions.every((recordedDecision) => {
        const currentDecision = workspace.decisions.find(
          (decision) => decision.id === recordedDecision.id
        );
        return (
          currentDecision?.status === "active" &&
          currentDecision.version === recordedDecision.version &&
          currentDecision.updatedAt === recordedDecision.updatedAt
        );
      }),
  }));
}

export async function evaluateUnit(
  projectId: string,
  unitId: string,
  modelClientFactory: ModelClientFactory,
  judgeRoutingPolicy: JudgeRoutingPolicy = DEFAULT_JUDGE_ROUTING_POLICY
) {
  const assignments = selectEvaluationJudgeAssignments(judgeRoutingPolicy);
  const unit = await getUnit(projectId, unitId);
  if (!unit) throw new Error("unit not found");

  const sources = await listSources(projectId);
  const client = await modelClientFactory();
  const structured = new StructuredClientAdapter(client);

  const evaluator = new EssayEvaluator(
    structured,
    assignments.documentary.judge.model,
    judgeRoutingPolicy
  );
  const evaluation = await evaluator.evaluate({
    unit,
    sources,
    claims: [],
  });

  const briefGenerator = new RevisionBriefGenerator();
  const brief = briefGenerator.generateBrief(evaluation, unit);

  return { evaluation, brief, assignments };
}

export async function markUnitVerified(
  projectId: string,
  unitId: string
): Promise<DraftUnit> {
  const updated = await updateUnit(projectId, unitId, { status: "verified" });
  if (!updated) throw new Error("unit not found");
  return updated;
}
