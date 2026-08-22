import type { EssayProject, Source, DraftUnit } from "@auto-essay/core";

const API = "/api";

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

export async function evaluateUnit(
  projectId: string,
  unitId: string
): Promise<{ evaluation: Record<string, unknown>; brief: Record<string, unknown> }> {
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
