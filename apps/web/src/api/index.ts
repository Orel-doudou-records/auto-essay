import type {
  BookPartInput,
  BookPlanInput,
  DiffractiveReading,
  EssayProject,
  Source,
  DraftUnit,
  JudgeAssignment,
} from "@auto-essay/core";

const API = "/api";

export interface DemoContextPayload {
  id: string;
  title: string;
  chapter: { id: string; title: string };
  context: {
    bookParts: BookPartInput[];
    bookPlan: BookPlanInput[];
    concepts: Array<{ label: string; definition: string }>;
    tensions: Array<{ label: string; description: string }>;
    bookBibliography: {
      entries: Array<{
        sourceId: string;
        title?: string;
        authors?: string[];
        subjects?: string[];
        concepts?: string[];
      }>;
      graphNeighborhoods?: Array<{ term: string; text: string }>;
    };
  };
  graphSummary: { nodes: number; links: number; terms: string[] };
  sourcesCount: number;
  suggestedFragments: Array<{ label: string; statement: string }>;
}

export type DiffractReadingPayload = {
  statement: string;
  bookParts?: BookPartInput[];
  bookPlan?: BookPlanInput[];
  concepts?: Array<{ label: string; definition: string }>;
  tensions?: Array<{ label: string; description: string }>;
  bookBibliography?: DemoContextPayload["context"]["bookBibliography"];
};

export async function fetchDemoContext(): Promise<DemoContextPayload> {
  const res = await fetch(`${API}/demo/judeofuturisme`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<DemoContextPayload>;
}

export async function runDiffractReading(
  payload: DiffractReadingPayload
): Promise<DiffractiveReading> {
  const res = await fetch(`${API}/diffract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<DiffractiveReading>;
}

export interface EditorialSectionContextPayload {
  projectId: string;
  section: { id: string; title: string };
  bookParts: Array<{ id: string; title: string; status: string }>;
  bookPlan: BookPlanInput[];
  existingCuts: Array<{ scope: string; verdict: string; cut: string }>;
  decisions: Array<{
    id: string;
    status: "active";
    contentCommitments: string[];
    formalCommitments: string[];
    validation: { validatedBy: "author"; validatedAt: string; note?: string };
    supersedesDecisionId?: string;
  }>;
  proposals: Array<{
    id: string;
    status: "candidate";
    contentCommitments: string[];
    formalCommitments: string[];
  }>;
  sources: Array<{
    sourceId: string;
    title: string;
    authors: string[];
    subjects: string[];
    concepts: string[];
    abstract?: string;
    qualified: boolean;
  }>;
}

export async function fetchEditorialSectionContext(
  projectId: string,
  sectionId: string
): Promise<EditorialSectionContextPayload> {
  const res = await fetch(`${API}/projects/${projectId}/editorial/sections/${sectionId}/context`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<EditorialSectionContextPayload>;
}

export interface ChapterEditorialWorkspacePayload {
  chapter: { id: string; title: string; writingStatus: string };
  sections: Array<{
    id: string;
    title: string;
    order: number;
    writingStatus: string;
    decisions: Array<{ id: string; contentCommitments: string[] }>;
    units: Array<{
      id: string;
      status: string;
      contentLength: number;
      preparedForWriting: boolean;
      provenance: { association: "manuscript_leaf" | "section_context" };
    }>;
    sources: Array<{
      sourceId: string;
      title: string;
      qualified: boolean;
      availability: "evidence_pack" | "visible_only";
      exclusionReason?: "missing_source" | "missing_or_unqualified_profile" | "missing_excerpt";
      provenance: {
        distributionScopeId: string;
        distributionRationale?: string;
        distributionConfidence?: number;
        profile?: { subjects: string[]; concepts: string[]; abstract?: string };
      };
    }>;
    readiness: "has_active_decision" | "needs_active_decision";
    transitions: {
      workshop: { sectionId: string; href: string };
      preparedUnits: Array<{ unitId: string; href: string }>;
    };
  }>;
}

export async function fetchChapterEditorialWorkspace(
  projectId: string,
  chapterId: string
): Promise<ChapterEditorialWorkspacePayload> {
  const res = await fetch(`${API}/projects/${projectId}/editorial/chapters/${chapterId}/workspace`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<ChapterEditorialWorkspacePayload>;
}

export interface ChapterOperationPayload {
  id: string;
  state: "preparing" | "awaiting_author" | "running" | "paused" | "failed" | "cancelled" | "completed";
  provenance: { projectId: string; chapterId: string; requestedBy: "author" };
  trace: Array<{
    type: string;
    actor: "author" | "system";
    occurredAt: string;
    detail?: string;
  }>;
}

type ChapterOperationResponse = { operation: ChapterOperationPayload; executed: false };

export async function createChapterOperation(
  projectId: string,
  chapterId: string
): Promise<ChapterOperationResponse> {
  return submitChapterOperation(projectId, "", "POST", { chapterId });
}

export async function awaitChapterOperationAuthor(
  projectId: string,
  operationId: string
): Promise<ChapterOperationResponse> {
  return submitChapterOperation(projectId, `${operationId}/await-author`, "POST");
}

export async function startChapterOperation(
  projectId: string,
  operationId: string
): Promise<ChapterOperationResponse> {
  return submitChapterOperation(projectId, `${operationId}/start`, "POST");
}

export async function pauseChapterOperation(
  projectId: string,
  operationId: string,
  detail?: string
): Promise<ChapterOperationResponse> {
  return submitChapterOperation(projectId, `${operationId}/pause`, "POST", { detail });
}

export async function resumeChapterOperation(
  projectId: string,
  operationId: string
): Promise<ChapterOperationResponse> {
  return submitChapterOperation(projectId, `${operationId}/resume`, "POST");
}

export async function cancelChapterOperation(
  projectId: string,
  operationId: string,
  detail?: string
): Promise<ChapterOperationResponse> {
  return submitChapterOperation(projectId, `${operationId}/cancel`, "POST", { detail });
}

async function submitChapterOperation(
  projectId: string,
  suffix: string,
  method: "POST",
  body: Record<string, unknown> = {}
): Promise<ChapterOperationResponse> {
  const path = suffix
    ? `${API}/projects/${projectId}/editorial/chapter-operations/${suffix}`
    : `${API}/projects/${projectId}/editorial/chapter-operations`;
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<ChapterOperationResponse>;
}

export interface EditorialWritingContextPayload {
  sectionId: string;
  decision: EditorialSectionContextPayload["decisions"][number];
  evidencePack: {
    sourceIds: string[];
    keyCitations: Array<{ sourceId: string; quote: string; context?: string; pageRange?: string }>;
    supportingClaimIds: string[];
    objections: Array<{ statement: string; sourceId?: string; responseStrategy?: string }>;
    authorNotes?: string;
  };
  visibleSources: Array<{
    sourceId: string;
    title: string;
    qualified: boolean;
    inclusion: "evidence_pack" | "visible_only";
    exclusionReason?: "missing_or_unqualified_profile" | "missing_excerpt";
    excerpt?: string;
    provenance: {
      distributionRationale?: string;
      distributionConfidence?: number;
      profile?: { subjects: string[]; concepts: string[]; abstract?: string };
      pageRange?: string;
    };
  }>;
}

export async function fetchEditorialWritingContext(
  projectId: string,
  sectionId: string,
  decisionId: string
): Promise<EditorialWritingContextPayload> {
  const params = new URLSearchParams({ decisionId });
  const res = await fetch(`${API}/projects/${projectId}/editorial/sections/${sectionId}/writing-context?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<EditorialWritingContextPayload>;
}

export async function createEditorialWritingDraftUnit(
  projectId: string,
  sectionId: string,
  payload: { decisionId: string; targetWordCount?: number }
): Promise<{ unit: Pick<DraftUnit, "id" | "content" | "targetWordCount">; generated: false }> {
  const res = await fetch(`${API}/projects/${projectId}/editorial/sections/${sectionId}/draft-units`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<{ unit: Pick<DraftUnit, "id" | "content" | "targetWordCount">; generated: false }>;
}

export async function runEditorialSectionReading(
  projectId: string,
  sectionId: string,
  payload: { statement: string; articulationId?: string }
): Promise<{ reading: DiffractiveReading; executable: false }> {
  const res = await fetch(`${API}/projects/${projectId}/editorial/sections/${sectionId}/readings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<{ reading: DiffractiveReading; executable: false }>;
}

type EditorialDecisionPayload = {
  contentCommitments: string[];
  formalCommitments: string[];
  invariants?: string[];
  prohibitedShortcuts?: string[];
  validationNote?: string;
};

async function submitEditorialProposal(
  projectId: string,
  proposalId: string,
  action: "accept" | "modify" | "reject",
  payload: EditorialDecisionPayload | { note?: string }
): Promise<void> {
  const res = await fetch(`${API}/projects/${projectId}/editorial/proposals/${proposalId}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export function acceptEditorialProposal(
  projectId: string,
  proposalId: string,
  payload: EditorialDecisionPayload
): Promise<void> {
  return submitEditorialProposal(projectId, proposalId, "accept", payload);
}

export function modifyEditorialProposal(
  projectId: string,
  proposalId: string,
  payload: EditorialDecisionPayload
): Promise<void> {
  return submitEditorialProposal(projectId, proposalId, "modify", payload);
}

export function rejectEditorialProposal(
  projectId: string,
  proposalId: string,
  note?: string
): Promise<void> {
  return submitEditorialProposal(projectId, proposalId, "reject", { note });
}

export async function fetchProjects(): Promise<EssayProject[]> {
  const res = await fetch(`${API}/projects`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.projects as EssayProject[];
}

export async function createProject(title: string, thesisSeed?: string): Promise<EssayProject> {
  const res = await fetch(`${API}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, thesisSeed }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.project as EssayProject;
}

export async function fetchProject(id: string): Promise<EssayProject> {
  const res = await fetch(`${API}/projects/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.project as EssayProject;
}

export async function updateProject(
  id: string,
  patch: Partial<Pick<EssayProject, "title" | "thesisSeed" | "voiceConfig" | "argumentMap">>
): Promise<EssayProject> {
  const res = await fetch(`${API}/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.project as EssayProject;
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`${API}/projects/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function fetchSources(projectId: string): Promise<Source[]> {
  const res = await fetch(`${API}/projects/${projectId}/sources`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.sources as Source[];
}

export async function importSources(
  projectId: string,
  files: { name: string; content: string }[]
): Promise<{ imported: number; errors: Array<{ file: string; message: string }> }> {
  const res = await fetch(`${API}/projects/${projectId}/sources/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function updateSource(
  projectId: string,
  sourceId: string,
  patch: Partial<Omit<Source, "id">>
): Promise<Source> {
  const res = await fetch(`${API}/projects/${projectId}/sources/${sourceId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.source as Source;
}

export async function deleteSource(projectId: string, sourceId: string): Promise<void> {
  const res = await fetch(`${API}/projects/${projectId}/sources/${sourceId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function fetchUnits(projectId: string): Promise<DraftUnit[]> {
  const res = await fetch(`${API}/projects/${projectId}/units`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.units as DraftUnit[];
}

export async function createUnit(
  projectId: string,
  section: string,
  targetWordCount?: number
): Promise<DraftUnit> {
  const res = await fetch(`${API}/projects/${projectId}/units`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ section, targetWordCount }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.unit as DraftUnit;
}

export async function updateUnit(
  projectId: string,
  unitId: string,
  patch: Partial<Pick<DraftUnit, "content" | "status" | "targetWordCount" | "thesis">>
): Promise<DraftUnit> {
  const res = await fetch(`${API}/projects/${projectId}/units/${unitId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.unit as DraftUnit;
}

export async function generateUnit(projectId: string, unitId: string): Promise<DraftUnit> {
  const res = await fetch(`${API}/projects/${projectId}/units/${unitId}/generate`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.unit as DraftUnit;
}

export async function reviseUnitChat(
  projectId: string,
  unitId: string,
  instruction: string
): Promise<{ before: string; after: string; unit: DraftUnit }> {
  const res = await fetch(`${API}/projects/${projectId}/units/${unitId}/revise-chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instruction }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export type { JudgeAssignment } from "@auto-essay/core";

export interface EvaluationJudgeAssignmentsPayload {
  documentary: JudgeAssignment;
  editorial: JudgeAssignment;
}

export async function fetchEvaluationJudgeAssignments(
  projectId: string,
  unitId: string
): Promise<EvaluationJudgeAssignmentsPayload> {
  const res = await fetch(`${API}/projects/${projectId}/units/${unitId}/evaluate/judges`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.assignments as EvaluationJudgeAssignmentsPayload;
}

export async function evaluateUnit(
  projectId: string,
  unitId: string
): Promise<{
  evaluation: Record<string, unknown>;
  brief: Record<string, unknown>;
  assignments: EvaluationJudgeAssignmentsPayload;
}> {
  const res = await fetch(`${API}/projects/${projectId}/units/${unitId}/evaluate`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function verifyUnit(projectId: string, unitId: string): Promise<DraftUnit> {
  const res = await fetch(`${API}/projects/${projectId}/units/${unitId}/evaluate/verify`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.unit as DraftUnit;
}

export async function exportProject(
  projectId: string,
  unitIds?: string[]
): Promise<{ markdown: string; sourceIds: string[] }> {
  const res = await fetch(`${API}/projects/${projectId}/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ unitIds }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
