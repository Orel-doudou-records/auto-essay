import type { DraftUnit } from "@auto-essay/core";
import { createModelClient } from "../llm/client.js";
import { getUnit, updateUnit } from "./unitStore.js";
import { listSources } from "./sourceStore.js";

export interface ReviseChatResult {
  before: string;
  after: string;
  unit: DraftUnit;
}

export async function reviseUnitChat(
  projectId: string,
  unitId: string,
  instruction: string
): Promise<ReviseChatResult> {
  const unit = await getUnit(projectId, unitId);
  if (!unit) throw new Error("unit not found");

  const sources = await listSources(projectId);
  const client = await createModelClient();

  const system = `Tu es un réviseur d'essais. Tu reçois une unité de rédaction et une instruction de révision.
Réponds uniquement avec le texte révisé, sans balises, sans commentaire.
Contraintes :
- Préserve les claims, citations et niveaux de confiance existants.
- N'ajoute pas de nouvelles sources non présentes dans l'evidence pack.
- Respecte la longueur cible de l'unité.`;

  const sourceList = unit.evidencePack.sourceIds
    .map((id) => sources.find((s) => s.id === id))
    .filter(Boolean)
    .map((s) => `- ${s?.title}`)
    .join("\n");

  const user = `## Unité à réviser
${unit.content}

## Sources utilisées
${sourceList || "Aucune"}

## Instruction
${instruction}`;

  const after = await client.complete(system, user);
  const updated = await updateUnit(projectId, unitId, {
    content: after,
    version: unit.version + 1,
  });
  if (!updated) throw new Error("unit not found");

  return { before: unit.content, after, unit: updated };
}

export async function streamReviseUnitChat(
  projectId: string,
  unitId: string,
  instruction: string,
  onEvent: (event: { type: string; payload?: unknown }) => void
): Promise<void> {
  const unit = await getUnit(projectId, unitId);
  if (!unit) throw new Error("unit not found");

  const sources = await listSources(projectId);
  const client = await createModelClient();

  onEvent({ type: "thinking" });

  const system = `Tu es un réviseur d'essais. Réponds avec la révision demandée, texte brut uniquement.`;
  const sourceList = unit.evidencePack.sourceIds
    .map((id) => sources.find((s) => s.id === id))
    .filter(Boolean)
    .map((s) => `- ${s?.title}`)
    .join("\n");
  const user = `## Unité à réviser\n${unit.content}\n\n## Sources\n${sourceList || "Aucune"}\n\n## Instruction\n${instruction}`;

  let after = "";
  await client.completeStream(system, user, (chunk) => {
    after += chunk;
    onEvent({ type: "chunk", payload: chunk });
  });

  const updated = await updateUnit(projectId, unitId, {
    content: after,
    version: unit.version + 1,
  });
  if (!updated) throw new Error("unit not found");

  onEvent({ type: "done", payload: { before: unit.content, after, unit: updated } });
}
