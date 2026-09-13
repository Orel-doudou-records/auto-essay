import type { DraftUnit, ManuscriptChild, ManuscriptNode } from "@auto-essay/core";
import { HTTPException } from "hono/http-exception";
import type { ModelClientFactory } from "../llm/client.js";
import { getWorkspace } from "./editorialWorkspaceStore.js";
import {
  appendScopeConversationExchange,
  readScopeConversation,
  type ScopeConversationMessage,
  type ScopeConversationScope,
} from "./scopeConversationStore.js";
import { getUnit, listUnits } from "./unitStore.js";

export async function getScopeConversation(
  projectId: string,
  scope: ScopeConversationScope
): Promise<ScopeConversationMessage[]> {
  await describeScope(projectId, scope);
  return readScopeConversation(projectId, scope);
}

export async function askScopeConversation(
  projectId: string,
  scope: ScopeConversationScope,
  message: string,
  modelClientFactory: ModelClientFactory
): Promise<ScopeConversationMessage[]> {
  const scopeContext = await describeScope(projectId, scope);
  const history = await readScopeConversation(projectId, scope);
  const client = await modelClientFactory();
  const system = `Tu es AutoEssay, assistant éditorial situé dans le scope courant d'un manuscrit.
La conversation sert à réfléchir, clarifier et discuter ce scope ; elle n'est jamais la source canonique d'une décision éditoriale.
Ne prétends jamais avoir modifié le manuscrit, le plan, les sources ou une décision.
Si l'auteur demande une réécriture ou une modification du texte, explique brièvement qu'elle doit passer par l'outil de révision dédié.
N'invente aucune source ni information absente du contexte fourni.`;
  const previous = history.length === 0
    ? "Aucun échange précédent."
    : history.map((entry) => `${entry.role === "author" ? "Auteur" : "AutoEssay"}: ${entry.content}`).join("\n\n");
  const prompt = `## Scope courant\n${scopeContext}\n\n## Conversation précédente\n${previous}\n\n## Nouveau message de l'auteur\n${message}`;
  const response = (await client.complete(system, prompt)).trim();
  if (!response) throw new Error("AutoEssay returned an empty scope conversation response");
  return appendScopeConversationExchange(projectId, scope, message, response);
}

async function describeScope(projectId: string, scope: ScopeConversationScope): Promise<string> {
  if (scope.kind === "unit") {
    const unit = await getUnit(projectId, scope.id);
    if (!unit) throw new HTTPException(404, { message: "conversation scope not found" });
    return describeUnit(unit);
  }

  const workspace = await getWorkspace(projectId);
  const node = findNode(workspace.manuscript.tree, scope.id);
  if (!node) throw new HTTPException(404, { message: "conversation scope not found" });
  const units = new Map((await listUnits(projectId)).map((unit) => [unit.id, unit]));
  return describeNode(node, units);
}

function findNode(children: ManuscriptChild[], nodeId: string): ManuscriptNode | undefined {
  for (const child of children) {
    if (child.kind !== "node") continue;
    if (child.id === nodeId) return child;
    const nested = findNode(child.children, nodeId);
    if (nested) return nested;
  }
  return undefined;
}

function describeUnit(unit: DraftUnit): string {
  const title = unit.thesis || unit.contextInPlan?.section || "Sans titre";
  return `Scope rédigé : ${title}\nGranularité : ${unit.granularity}\n\n${unit.content || "(aucun texte rédigé)"}`;
}

function describeNode(node: ManuscriptNode, units: Map<string, DraftUnit>, depth = 0): string {
  const heading = `${"#".repeat(Math.min(depth + 2, 6))} ${node.title}`;
  const parts = [heading];
  if (node.text?.trim()) parts.push(node.text.trim());
  if (node.plan?.length) {
    parts.push(`Plan :\n${node.plan.map((entry) => `- ${entry.subject}`).join("\n")}`);
  }
  for (const child of node.children) {
    if (child.kind === "node") {
      parts.push(describeNode(child, units, depth + 1));
      continue;
    }
    const unit = units.get(child.unitId);
    if (unit) parts.push(describeUnit(unit));
  }
  return parts.join("\n\n");
}
