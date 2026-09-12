import type { DraftUnit, RevisionProposal } from "@auto-essay/core";

const API = "/api";

export type PublicCollaborativeRevisionWork = {
  id: string;
  unitId: string;
  base: {
    unitId: string;
    unitVersion: number;
    contentHash: string;
    content: string;
  };
  proposedContent: string;
  status: "working" | "stale" | "rejected" | "integrated";
};

export type RevisionSuggestionPayload =
  | { proposal: RevisionProposal }
  | { kind: "collaborative"; work: PublicCollaborativeRevisionWork };

export type CollaborativeRevisionConflict = {
  kind: "version" | "textual" | "structural" | "editorial";
  reason: string;
};

export type CollaborativeRevisionCommandResult =
  | {
      kind: "collaborative";
      status: "integrated";
      work: PublicCollaborativeRevisionWork;
      unit: DraftUnit;
    }
  | {
      kind: "collaborative";
      status: "rejected";
      work: PublicCollaborativeRevisionWork;
    }
  | {
      kind: "collaborative";
      status: "stale" | "conflict";
      work: PublicCollaborativeRevisionWork;
      conflicts: CollaborativeRevisionConflict[];
    }
  | {
      kind: "collaborative";
      status: "recovery_failed";
      code: string;
      message: string;
    }
  | {
      kind: "collaborative";
      status: "unsupported_projection_drift" | "scope_mismatch";
      work?: PublicCollaborativeRevisionWork;
      message: string;
    };

async function readJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

async function responseMessage(response: Response): Promise<string> {
  try {
    const body = await readJson<{ message?: string }>(response);
    return body.message ?? `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

export async function reviseUnitChatCompatible(
  projectId: string,
  unitId: string,
  instruction: string
): Promise<RevisionSuggestionPayload> {
  const response = await fetch(`${API}/projects/${projectId}/units/${unitId}/revise-chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instruction }),
  });
  if (!response.ok) throw new Error(await responseMessage(response));
  return readJson<RevisionSuggestionPayload>(response);
}

export async function acceptCollaborativeRevisionWork(
  projectId: string,
  unitId: string,
  workId: string,
  content: string
): Promise<CollaborativeRevisionCommandResult> {
  const response = await fetch(
    `${API}/projects/${projectId}/units/${unitId}/revision-work/${encodeURIComponent(workId)}/accept`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }
  );
  if (response.status !== 409 && !response.ok) {
    throw new Error(await responseMessage(response));
  }
  return readJson<CollaborativeRevisionCommandResult>(response);
}

export async function rejectCollaborativeRevisionWork(
  projectId: string,
  unitId: string,
  workId: string
): Promise<CollaborativeRevisionCommandResult> {
  const response = await fetch(
    `${API}/projects/${projectId}/units/${unitId}/revision-work/${encodeURIComponent(workId)}/reject`,
    { method: "POST" }
  );
  if (response.status !== 409 && !response.ok) {
    throw new Error(await responseMessage(response));
  }
  return readJson<CollaborativeRevisionCommandResult>(response);
}

export function isCollaborativeRevisionSuggestion(
  result: RevisionSuggestionPayload
): result is { kind: "collaborative"; work: PublicCollaborativeRevisionWork } {
  return "kind" in result && result.kind === "collaborative";
}
