import type { ModelClientFactory } from "../llm/client.js";
import { getUnit } from "./unitStore.js";
import { createRevisionProposal } from "./revisionProposalStore.js";
import { listSources } from "./sourceStore.js";
import type { RevisionProposal } from "@auto-essay/core";

export interface ReviseChatResult {
  proposal: RevisionProposal;
}

export async function reviseUnitChat(
  projectId: string,
  unitId: string,
  instruction: string,
  modelClientFactory: ModelClientFactory
): Promise<ReviseChatResult> {
  const unit = await getUnit(projectId, unitId);
  if (!unit) throw new Error("unit not found");

  const sources = await listSources(projectId);
  const client = await modelClientFactory();

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
  const proposal = await createRevisionProposal(projectId, unitId, unit.version, unit.content, after);
  return { proposal };
}

export async function streamReviseUnitChat(
  projectId: string,
  unitId: string,
  instruction: string,
  onEvent: (event: { type: string; payload?: unknown }) => void,
  modelClientFactory: ModelClientFactory
): Promise<void> {
  const unit = await getUnit(projectId, unitId);
  if (!unit) throw new Error("unit not found");

  const sources = await listSources(projectId);
  const client = await modelClientFactory();

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

  const proposal = await createRevisionProposal(projectId, unitId, unit.version, unit.content, after);
  onEvent({ type: "done", payload: { proposal } });
}
