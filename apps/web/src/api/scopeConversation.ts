const API = "/api";

export type ScopeConversationRef = {
  kind: "node" | "unit";
  id: string;
};

export type ScopeConversationMessage = {
  id: string;
  role: "author" | "autoessay";
  content: string;
  createdAt: string;
};

type ScopeConversationResponse = { messages: ScopeConversationMessage[] };

export async function fetchScopeConversation(
  projectId: string,
  scope: ScopeConversationRef
): Promise<ScopeConversationMessage[]> {
  const response = await fetch(scopeConversationUrl(projectId, scope));
  if (!response.ok) throw new Error(await responseMessage(response));
  return (await response.json() as ScopeConversationResponse).messages;
}

export async function sendScopeConversationMessage(
  projectId: string,
  scope: ScopeConversationRef,
  message: string
): Promise<ScopeConversationMessage[]> {
  const response = await fetch(scopeConversationUrl(projectId, scope), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!response.ok) throw new Error(await responseMessage(response));
  return (await response.json() as ScopeConversationResponse).messages;
}

function scopeConversationUrl(projectId: string, scope: ScopeConversationRef): string {
  return `${API}/projects/${encodeURIComponent(projectId)}/scope-conversation/${scope.kind}/${encodeURIComponent(scope.id)}`;
}

async function responseMessage(response: Response): Promise<string> {
  try {
    const body = await response.json() as { message?: string };
    return body.message ?? `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}
