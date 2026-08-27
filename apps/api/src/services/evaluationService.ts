import {
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
import { listSources } from "./sourceStore.js";

export function selectEvaluationJudgeAssignments(
  judgeRoutingPolicy: JudgeRoutingPolicy = DEFAULT_JUDGE_ROUTING_POLICY
) {
  return {
    documentary: selectJudgeAssignment(judgeRoutingPolicy, "documentary_evaluation"),
    editorial: selectJudgeAssignment(judgeRoutingPolicy, "editorial_effect_evaluation"),
  };
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
