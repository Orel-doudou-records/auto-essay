import {
  assessIntegratedEvaluationReadiness,
  createParagraphGenerator,
  type DraftUnit,
} from "@auto-essay/core";
import type { ModelClientFactory } from "../llm/client.js";
import { StructuredClientAdapter } from "../llm/structuredAdapter.js";
import { getUnit, updateUnit } from "./unitStore.js";
import {
  getIntegratedEvaluationContext,
  updateIntegratedEvaluationContext,
} from "./integratedEvaluationContextStore.js";
import { listSources } from "./sourceStore.js";
import { getWorkspace } from "./editorialWorkspaceStore.js";

export async function generateUnitContent(
  projectId: string,
  unitId: string,
  modelClientFactory: ModelClientFactory
): Promise<DraftUnit> {
  const unit = await getUnit(projectId, unitId);
  if (!unit) throw new Error("unit not found");

  const [sources, integratedContext] = await Promise.all([
    listSources(projectId),
    unit.content.trim().length === 0
      ? getIntegratedEvaluationContext(projectId, unitId)
      : Promise.resolve(undefined),
  ]);
  const workspace = integratedContext
    ? await getWorkspace(projectId)
    : undefined;
  const readiness = integratedContext && workspace
    ? assessIntegratedEvaluationReadiness({
        unit,
        decisions: workspace.decisions,
        context: integratedContext,
      })
    : undefined;
  const writerContext =
    readiness?.status === "ready" ||
    readiness?.reasons.some((reason) => reason.code === "missing_compatible_traces")
      ? integratedContext
      : undefined;

  const client = await modelClientFactory();
  const structured = new StructuredClientAdapter(client);

  const generator = createParagraphGenerator(structured);
  const result = await generator.generateParagraph(unit.evidencePack, sources, {
    section: unit.contextInPlan?.section,
    thesis: unit.thesis,
    unitId: unit.id,
    unitVersion: writerContext?.writerProjection.unitVersion ?? unit.version,
    editorialProjection: writerContext?.writerProjection,
  });

  const updated = await updateUnit(projectId, unitId, {
    content: result.content,
    version: unit.version + 1,
    transformationTraceIds: writerContext
      ? result.transformationTraces.map((trace) => trace.id)
      : unit.transformationTraceIds,
  });
  if (!updated) throw new Error("unit not found");

  if (writerContext) {
    await updateIntegratedEvaluationContext(projectId, unitId, (context) => ({
      ...context,
      transformationTraces: result.transformationTraces,
    }));
  }

  return updated;
}
