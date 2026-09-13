const API = "/api";

export type ScopeContextRef = {
  kind: "node" | "unit";
  id: string;
};

export type ScopeContextSource = {
  id: string;
  title: string;
  authors: string[];
  included: boolean;
  state: "explored" | "partial" | "registered_unexplored" | "unusable";
  subjects: string[];
  concepts: string[];
  abstract?: string;
  coverage: { coveredBlocks: number; totalBlocks: number } | null;
};

export type ScopeContext = {
  scope: ScopeContextRef;
  text: string;
  planning: {
    id: string;
    version: number;
    question: string;
    intention?: string;
    angleOrFunction?: string;
    constraints: string[];
  } | null;
  decisions: Array<{
    id: string;
    contentCommitments: string[];
    formalCommitments: string[];
    invariants: string[];
    prohibitedShortcuts: string[];
    validatedAt: string;
  }>;
  sources: ScopeContextSource[];
  passages: Array<{
    sourceId: string;
    text: string;
    pageRange?: string;
    context?: string;
  }>;
  exploration: {
    complete: boolean;
    status: "has_context" | "empty_library" | "no_result" | "incomplete";
    gaps: Array<{ description: string; consequence: string; neededEvidence?: string }>;
    underDocumentedHypotheses: string[];
  };
  sourceSelection: {
    editable: boolean;
    authority: "planning_brief" | "legacy_or_none" | "evidence_pack";
  };
};

export async function fetchScopeContext(
  projectId: string,
  scope: ScopeContextRef
): Promise<ScopeContext> {
  const response = await fetch(scopeContextUrl(projectId, scope));
  if (!response.ok) throw new Error(await responseMessage(response));
  return response.json() as Promise<ScopeContext>;
}

export async function setScopeContextSourceIncluded(
  projectId: string,
  scope: ScopeContextRef,
  sourceId: string,
  included: boolean
): Promise<ScopeContext> {
  const response = await fetch(
    `${scopeContextUrl(projectId, scope)}/sources/${encodeURIComponent(sourceId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ included }),
    }
  );
  if (!response.ok) throw new Error(await responseMessage(response));
  return response.json() as Promise<ScopeContext>;
}

function scopeContextUrl(projectId: string, scope: ScopeContextRef): string {
  return `${API}/projects/${encodeURIComponent(projectId)}/scope-context/${scope.kind}/${encodeURIComponent(scope.id)}`;
}

async function responseMessage(response: Response): Promise<string> {
  try {
    const body = await response.json() as { message?: string };
    return body.message ?? `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}
