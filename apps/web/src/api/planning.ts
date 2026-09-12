import type {
  AdaptivePlanningDecomposition,
  PlanningArchitectureProposal,
  PlanningBrief,
  PlanningReadinessAssessment,
  PlanningStructuralChange,
  PlanningSubjectExploration,
  PlanningSubjectProposal,
} from "@auto-essay/core";

const API = "/api";

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = await response.json() as { message?: string; error?: string };
      message = body.message ?? body.error ?? message;
    } catch {
      // Keep HTTP status as fallback.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export interface PlanningStatePayload {
  manuscriptId: string;
  mode: "from_zero" | "existing_plan";
  activeBrief?: PlanningBrief;
  readiness?: PlanningReadinessAssessment;
  coverage: {
    registeredSourceCount: number;
    representedSourceCount: number;
    explorationComplete: boolean;
    note: string;
  };
}

export interface PlanRefinementPayload {
  readingId: string;
  verdict: string;
  diagnostics: Array<{
    partId: string;
    entryId?: string;
    kind: string;
    reason: string;
  }>;
  transformations: Array<{
    kind: string;
    partId: string;
    entryId?: string;
    current: string;
    proposal: string;
    reason: string;
    consequences: string[];
    requiresAuthorDecision: boolean;
    missingEvidence?: string;
  }>;
  remoteImpacts: Array<{
    partId: string;
    partTitle: string;
    entryId?: string;
    impact: string;
  }>;
}

export async function fetchPlanningState(
  projectId: string,
  scopeKind: "manuscript" | "node" | "plan_entry" = "manuscript",
  scopeId?: string
): Promise<PlanningStatePayload> {
  const query = new URLSearchParams({ scopeKind });
  if (scopeId) query.set("scopeId", scopeId);
  return requestJson(`${API}/projects/${projectId}/planning/state?${query.toString()}`);
}

export async function explorePlanningSubjects(
  projectId: string,
  cadrage?: string
): Promise<PlanningSubjectExploration> {
  return requestJson(`${API}/projects/${projectId}/planning/explore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cadrage: cadrage?.trim() || undefined }),
  });
}

export async function refinePlanning(
  projectId: string
): Promise<PlanRefinementPayload> {
  return requestJson(`${API}/projects/${projectId}/planning/refine`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
}

export async function createPlanningBriefFromSubjectRequest(
  projectId: string,
  manuscriptId: string,
  nodeId: string | undefined,
  subject: PlanningSubjectProposal
): Promise<PlanningBrief> {
  const scopeRef = nodeId
    ? { kind: "node" as const, projectId, manuscriptId, nodeId }
    : { kind: "manuscript" as const, projectId, manuscriptId };
  const result = await requestJson<{ brief: PlanningBrief }>(
    `${API}/projects/${projectId}/planning/briefs/from-subject`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scopeRef, subject }),
    }
  );
  return result.brief;
}

export async function supersedePlanningBriefRequest(
  projectId: string,
  briefId: string,
  changes: Partial<Pick<PlanningBrief, "question" | "intention" | "angleOrFunction" | "hypotheses" | "gaps" | "constraints" | "sourceRefs" | "rationale">>
): Promise<PlanningBrief> {
  const result = await requestJson<{ brief: PlanningBrief }>(
    `${API}/projects/${projectId}/planning/briefs/${briefId}/supersede`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    }
  );
  return result.brief;
}

export async function proposePlanningDecomposition(
  projectId: string,
  briefId: string
): Promise<AdaptivePlanningDecomposition> {
  return requestJson(`${API}/projects/${projectId}/planning/decompose`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ briefId }),
  });
}

export async function createPlanningStructuralDiff(
  projectId: string,
  briefId: string,
  architecture: PlanningArchitectureProposal
): Promise<{ changes: PlanningStructuralChange[] }> {
  return requestJson(`${API}/projects/${projectId}/planning/diff`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ briefId, architecture }),
  });
}

export async function applyPlanningStructuralDiff(
  projectId: string,
  changes: PlanningStructuralChange[]
): Promise<{ appliedChangeIds: string[] }> {
  return requestJson(`${API}/projects/${projectId}/planning/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ authorApproved: true, changes }),
  });
}
