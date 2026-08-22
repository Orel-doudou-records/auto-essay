import { EssayEvaluator, RevisionBriefGenerator, type DraftUnit } from "@auto-essay/core";
import { createModelClient } from "../llm/client.js";
import { StructuredClientAdapter } from "../llm/structuredAdapter.js";
import { getUnit, updateUnit } from "./unitStore.js";
import { listSources } from "./sourceStore.js";

export async function evaluateUnit(projectId: string, unitId: string) {
  const unit = await getUnit(projectId, unitId);
  if (!unit) throw new Error("unit not found");

  const sources = await listSources(projectId);
  const client = await createModelClient();
  const structured = new StructuredClientAdapter(client);

  const evaluator = new EssayEvaluator(structured, "judge-model");
  const evaluation = await evaluator.evaluate({
    unit,
    sources,
    claims: [],
  });

  const briefGenerator = new RevisionBriefGenerator();
  const brief = briefGenerator.generateBrief(evaluation, unit);

  return { evaluation, brief };
}

export async function markUnitVerified(
  projectId: string,
  unitId: string
): Promise<DraftUnit> {
  const updated = await updateUnit(projectId, unitId, { status: "verified" });
  if (!updated) throw new Error("unit not found");
  return updated;
}
