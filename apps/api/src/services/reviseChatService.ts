import type { RevisionProposal } from "@auto-essay/core";
import { HTTPException } from "hono/http-exception";
import type { ModelClientFactory } from "../llm/client.js";
import {
  captureCollaborativeRevisionSource,
  createCollaborativeParagraphRevision,
  type CapturedRevisionSource,
} from "./collaborativeRevisionWork.js";
import type { CollaborativeRevisionWorkDto } from "./collaborativeRevisionWorkStore.js";
import { createRevisionProposal } from "./revisionProposalStore.js";
import { listSources } from "./sourceStore.js";
import { getUnit } from "./unitStore.js";

export type ReviseChatResult =
  | { proposal: RevisionProposal }
  | {
      kind: "collaborative";
      status: "created";
      work: CollaborativeRevisionWorkDto;
    }
  | {
      kind: "collaborative";
      status: "candidate_stale_before_workspace";
    }
  | {
      kind: "collaborative";
      status: "unsupported_projection_drift";
      message: string;
    };

function isAmbiguousCollaborativeRevisionTarget(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("resolves to multiple literary identities") ||
    error.message.includes("is linked from multiple PlanEntry identities")
  );
}

async function captureRevisionSource(
  projectId: string,
  unitId: string
): Promise<CapturedRevisionSource> {
  try {
    return await captureCollaborativeRevisionSource(projectId, unitId);
  } catch (error) {
    if (
      (error instanceof HTTPException && error.status === 404) ||
      isAmbiguousCollaborativeRevisionTarget(error)
    ) {
      return { authority: "legacy", projectId, unitId };
    }
    throw error;
  }
}

async function finalizeRevisionCandidate(input: {
  projectId: string;
  unitId: string;
  source: CapturedRevisionSource;
  sourceVersion: number;
  sourceContent: string;
  proposedContent: string;
}): Promise<ReviseChatResult> {
  if (input.source.authority === "legacy") {
    const proposal = await createRevisionProposal(
      input.projectId,
      input.unitId,
      input.sourceVersion,
      input.sourceContent,
      input.proposedContent
    );
    return { proposal };
  }

  const result = await createCollaborativeParagraphRevision({
    projectId: input.projectId,
    source: input.source,
    proposedContent: input.proposedContent,
  });
  if (result.status === "created") {
    return {
      kind: "collaborative",
      status: "created",
      work: result.work,
    };
  }
  if (result.status === "unsupported_projection_drift") {
    return {
      kind: "collaborative",
      status: result.status,
      message: result.reason,
    };
  }
  return {
    kind: "collaborative",
    status: "candidate_stale_before_workspace",
  };
}

export async function reviseUnitChat(
  projectId: string,
  unitId: string,
  instruction: string,
  modelClientFactory: ModelClientFactory
): Promise<ReviseChatResult> {
  const source = await captureRevisionSource(projectId, unitId);
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
  const sourceContent = source.authority === "collaborative-core" ? source.content : unit.content;
  const sourceVersion = source.authority === "collaborative-core"
    ? source.fingerprint.unitVersion
    : unit.version;

  const user = `## Unité à réviser
${sourceContent}

## Sources utilisées
${sourceList || "Aucune"}

## Instruction
${instruction}`;

  const after = await client.complete(system, user);
  return finalizeRevisionCandidate({
    projectId,
    unitId,
    source,
    sourceVersion,
    sourceContent,
    proposedContent: after,
  });
}

export async function streamReviseUnitChat(
  projectId: string,
  unitId: string,
  instruction: string,
  onEvent: (event: { type: string; payload?: unknown }) => void,
  modelClientFactory: ModelClientFactory
): Promise<void> {
  const source = await captureRevisionSource(projectId, unitId);
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
  const sourceContent = source.authority === "collaborative-core" ? source.content : unit.content;
  const sourceVersion = source.authority === "collaborative-core"
    ? source.fingerprint.unitVersion
    : unit.version;
  const user = `## Unité à réviser\n${sourceContent}\n\n## Sources\n${sourceList || "Aucune"}\n\n## Instruction\n${instruction}`;

  let after = "";
  await client.completeStream(system, user, (chunk) => {
    after += chunk;
    onEvent({ type: "chunk", payload: chunk });
  });

  const result = await finalizeRevisionCandidate({
    projectId,
    unitId,
    source,
    sourceVersion,
    sourceContent,
    proposedContent: after,
  });
  onEvent({ type: "done", payload: result });
}
