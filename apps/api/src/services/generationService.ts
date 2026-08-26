import { createParagraphGenerator, type DraftUnit } from "@auto-essay/core";
import type { ModelClientFactory } from "../llm/client.js";
import { StructuredClientAdapter } from "../llm/structuredAdapter.js";
import { getUnit, updateUnit } from "./unitStore.js";
import { listSources } from "./sourceStore.js";

export async function generateUnitContent(
  projectId: string,
  unitId: string,
  modelClientFactory: ModelClientFactory
): Promise<DraftUnit> {
  const unit = await getUnit(projectId, unitId);
  if (!unit) throw new Error("unit not found");

  const sources = await listSources(projectId);
  const client = await modelClientFactory();
  const structured = new StructuredClientAdapter(client);

  const generator = createParagraphGenerator(structured);
  const result = await generator.generateParagraph(unit.evidencePack, sources, {
    section: unit.contextInPlan?.section,
    thesis: unit.thesis,
    unitId: unit.id,
    unitVersion: unit.version,
  });

  const updated = await updateUnit(projectId, unitId, {
    content: result.content,
    version: unit.version + 1,
  });
  if (!updated) throw new Error("unit not found");
  return updated;
}
