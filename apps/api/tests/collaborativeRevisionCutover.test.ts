import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DraftUnitSchema,
  ManuscriptSchema,
  type DraftUnit,
  type Manuscript,
} from "@auto-essay/core";
import { MockClient } from "../src/llm/mockClient.js";
import { listAutomaticDiffractiveReadings } from "../src/services/automaticDiffractiveReadingStore.js";
import {
  getWorkspace,
  putWorkspace,
  setDiffractiveReadingMode,
} from "../src/services/editorialWorkspaceStore.js";
import { loadCollaborativeRevisionWork } from "../src/services/collaborativeRevisionWorkStore.js";
import { getUnit, setUnits } from "../src/services/unitStore.js";
import { makeTempDataDir, makeTestApp, postJson } from "./helper.js";

const projectId = "project-revision-cutover";
const unitId = "unit-revision-cutover";
const sectionId = "section-revision-cutover";
const createdAt = "2026-09-12T12:00:00.000Z";

function fixture(mounted: boolean): { manuscript: Manuscript; unit: DraftUnit } {
  const unit = DraftUnitSchema.parse({
    id: unitId,
    projectId,
    granularity: "paragraph",
    targetWordCount: 180,
    contextInPlan: { section: sectionId },
    evidencePack: { sourceIds: [] },
    content: "Canonical paragraph.",
    claimIds: [],
    citationUses: [],
    appliedDecisionIds: [],
    appliedArticulationIds: [],
    transformationTraceIds: [],
    status: "drafting",
    version: 4,
    createdAt,
    updatedAt: createdAt,
  });
  const manuscript = ManuscriptSchema.parse({
    id: "manuscript-revision-cutover",
    projectId,
    title: "Revision cutover essay",
    tree: [
      {
        kind: "node",
        id: "chapter-revision-cutover",
        title: "Chapter",
        children: [
          {
            kind: "node",
            id: sectionId,
            title: "Section",
            plan: mounted
              ? [{
                  id: "paragraph-revision-cutover",
                  subject: "Paragraph",
                  unitId,
                  unitVersion: 4,
                  notes: [],
                }]
              : [],
            children: mounted ? [{ kind: "leaf", unitId, version: 4 }] : [],
          },
        ],
      },
    ],
    createdAt,
    updatedAt: createdAt,
  });
  return { manuscript, unit };
}

async function storeFixture(dataDir: string, source: { manuscript: Manuscript; unit: DraftUnit }): Promise<void> {
  process.env.AUTO_ESSAY_DATA_DIR = dataDir;
  await setUnits(projectId, [source.unit]);
  await putWorkspace(projectId, {
    manuscript: source.manuscript,
    distribution: [],
    profiles: [],
    articulations: [],
  });
}

async function seed(dataDir: string, mounted: boolean): Promise<void> {
  await storeFixture(dataDir, fixture(mounted));
}

async function seedAmbiguousParagraph(dataDir: string): Promise<void> {
  const source = fixture(true);
  const manuscript = ManuscriptSchema.parse({
    ...source.manuscript,
    tree: [
      {
        kind: "node",
        id: "chapter-revision-cutover",
        title: "Chapter",
        children: [
          {
            kind: "node",
            id: "section-revision-cutover-a",
            title: "Section A",
            plan: [{
              id: "paragraph-revision-cutover-a",
              subject: "Paragraph A",
              unitId,
              unitVersion: 4,
              notes: [],
            }],
            children: [{ kind: "leaf", unitId, version: 4 }],
          },
          {
            kind: "node",
            id: "section-revision-cutover-b",
            title: "Section B",
            plan: [{
              id: "paragraph-revision-cutover-b",
              subject: "Paragraph B",
              unitId,
              unitVersion: 4,
              notes: [],
            }],
            children: [{ kind: "leaf", unitId, version: 4 }],
          },
        ],
      },
    ],
  });
  await storeFixture(dataDir, { manuscript, unit: source.unit });
}

async function seedMountedSection(dataDir: string): Promise<void> {
  const unit = DraftUnitSchema.parse({
    ...fixture(true).unit,
    granularity: "section",
    contextInPlan: undefined,
    content: "Canonical section.",
  });
  const manuscript = ManuscriptSchema.parse({
    id: "manuscript-revision-cutover",
    projectId,
    title: "Revision cutover essay",
    tree: [{
      kind: "node",
      id: "chapter-revision-cutover",
      title: "Chapter",
      children: [{ kind: "leaf", unitId, version: 4 }],
    }],
    createdAt,
    updatedAt: createdAt,
  });
  await storeFixture(dataDir, { manuscript, unit });
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function legacyProposalPath(dataDir: string): string {
  return path.join(dataDir, projectId, "revision-proposals.json");
}

function parseServerSentEvents(body: string): Array<{ type: string; payload?: unknown }> {
  return body
    .split("\n\n")
    .filter((entry) => entry.startsWith("data: ") && entry !== "data: [DONE]")
    .map((entry) => JSON.parse(entry.slice("data: ".length)) as { type: string; payload?: unknown });
}

function testApp(dataDir: string) {
  return makeTestApp(dataDir, {
    modelClientFactory: async () => new MockClient(),
  });
}

async function requestCollaborativeRevision(app: ReturnType<typeof testApp>) {
  const response = await postJson(
    app,
    `/api/projects/${projectId}/units/${unitId}/revise-chat`,
    { instruction: "Resserre le paragraphe." }
  );
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.kind).toBe("collaborative");
  return body as { kind: "collaborative"; work: { id: string; status: string } };
}

describe("AE2 production revise-chat authority cutover", () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = makeTempDataDir();
  });

  afterEach(async () => {
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  it("routes an eligible mounted paragraph exclusively to collaborative work", async () => {
    await seed(dataDir, true);
    const app = testApp(dataDir);

    const response = await postJson(
      app,
      `/api/projects/${projectId}/units/${unitId}/revise-chat`,
      { instruction: "Resserre le paragraphe." }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      kind: "collaborative",
      work: {
        unitId,
        status: "working",
        base: { unitId, unitVersion: 4, content: "Canonical paragraph." },
      },
    });
    expect(body).not.toHaveProperty("proposal");
    expect(await loadCollaborativeRevisionWork(projectId, body.work.id)).toBeDefined();
    expect(await exists(legacyProposalPath(dataDir))).toBe(false);
    expect(await getUnit(projectId, unitId)).toMatchObject({
      content: "Canonical paragraph.",
      version: 4,
    });
  });

  it("keeps an unmounted paragraph exclusively on the legacy proposal path", async () => {
    await seed(dataDir, false);
    const app = testApp(dataDir);

    const response = await postJson(
      app,
      `/api/projects/${projectId}/units/${unitId}/revise-chat`,
      { instruction: "Resserre le paragraphe." }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.proposal).toMatchObject({
      projectId,
      unitId,
      sourceVersion: 4,
      before: "Canonical paragraph.",
      status: "available",
    });
    expect(body).not.toHaveProperty("kind");
    expect(await exists(legacyProposalPath(dataDir))).toBe(true);
  });

  it("keeps a mounted section on the legacy proposal path", async () => {
    await seedMountedSection(dataDir);
    const app = testApp(dataDir);

    const response = await postJson(
      app,
      `/api/projects/${projectId}/units/${unitId}/revise-chat`,
      { instruction: "Resserre la section." }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.proposal).toMatchObject({
      projectId,
      unitId,
      sourceVersion: 4,
      before: "Canonical section.",
      status: "available",
    });
    expect(body).not.toHaveProperty("kind");
    expect(await exists(legacyProposalPath(dataDir))).toBe(true);
  });

  it("keeps an ambiguous paragraph target on the legacy proposal path", async () => {
    await seedAmbiguousParagraph(dataDir);
    const app = testApp(dataDir);

    const response = await postJson(
      app,
      `/api/projects/${projectId}/units/${unitId}/revise-chat`,
      { instruction: "Resserre le paragraphe." }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.proposal).toMatchObject({
      projectId,
      unitId,
      sourceVersion: 4,
      before: "Canonical paragraph.",
      status: "available",
    });
    expect(body).not.toHaveProperty("kind");
    expect(await exists(legacyProposalPath(dataDir))).toBe(true);
  });

  it("uses the same collaborative authority at streaming completion", async () => {
    await seed(dataDir, true);
    const app = testApp(dataDir);

    const response = await postJson(
      app,
      `/api/projects/${projectId}/units/${unitId}/revise-chat/stream`,
      { instruction: "Resserre le paragraphe." }
    );

    expect(response.status).toBe(200);
    const events = parseServerSentEvents(await response.text());
    const done = events.find((event) => event.type === "done");
    expect(done?.payload).toMatchObject({
      kind: "collaborative",
      work: { unitId, status: "working" },
    });
    const payload = done?.payload as { work?: { id?: string } } | undefined;
    expect(payload?.work?.id).toBeTruthy();
    expect(await loadCollaborativeRevisionWork(projectId, payload!.work!.id!)).toBeDefined();
    expect(await exists(legacyProposalPath(dataDir))).toBe(false);
    expect(await getUnit(projectId, unitId)).toMatchObject({
      content: "Canonical paragraph.",
      version: 4,
    });
  });

  it("rejects collaborative work without changing canonical content or scheduling downstream work", async () => {
    await seed(dataDir, true);
    await setDiffractiveReadingMode(projectId, sectionId, "automatic");
    const app = testApp(dataDir);
    const revision = await requestCollaborativeRevision(app);

    const rejectResponse = await postJson(
      app,
      `/api/projects/${projectId}/units/${unitId}/revision-work/${encodeURIComponent(revision.work.id)}/reject`,
      {}
    );

    expect(rejectResponse.status).toBe(200);
    expect(await rejectResponse.json()).toMatchObject({
      kind: "collaborative",
      status: "rejected",
      work: { id: revision.work.id, status: "rejected" },
    });
    expect(await getUnit(projectId, unitId)).toMatchObject({
      content: "Canonical paragraph.",
      version: 4,
    });
    expect(await listAutomaticDiffractiveReadings(projectId, sectionId)).toEqual([]);
    expect(await exists(legacyProposalPath(dataDir))).toBe(false);
  });

  it("keeps concurrent autosave drift canonical and blocks collaborative integration", async () => {
    await seed(dataDir, true);
    await setDiffractiveReadingMode(projectId, sectionId, "automatic");
    const app = testApp(dataDir);
    const revision = await requestCollaborativeRevision(app);
    const current = await getUnit(projectId, unitId);
    expect(current).toBeDefined();
    await setUnits(projectId, [
      DraftUnitSchema.parse({
        ...current!,
        content: "Concurrent autosave content.",
        updatedAt: "2026-09-12T12:05:00.000Z",
      }),
    ]);

    const acceptResponse = await postJson(
      app,
      `/api/projects/${projectId}/units/${unitId}/revision-work/${encodeURIComponent(revision.work.id)}/accept`,
      { content: "Collaborative candidate." }
    );

    expect(acceptResponse.status).toBe(409);
    const body = await acceptResponse.json();
    expect(["stale", "conflict"]).toContain(body.status);
    expect(await getUnit(projectId, unitId)).toMatchObject({
      content: "Concurrent autosave content.",
      version: 4,
    });
    expect(await listAutomaticDiffractiveReadings(projectId, sectionId)).toEqual([]);
    expect(await exists(legacyProposalPath(dataDir))).toBe(false);
  });

  it("materializes one next version and schedules text_changed only after applied integration", async () => {
    await seed(dataDir, true);
    await setDiffractiveReadingMode(projectId, sectionId, "automatic");
    const app = testApp(dataDir);

    const revision = await requestCollaborativeRevision(app);
    expect(await listAutomaticDiffractiveReadings(projectId, sectionId)).toEqual([]);

    const acceptedContent = "Author-edited collaborative revision.";
    const acceptResponse = await postJson(
      app,
      `/api/projects/${projectId}/units/${unitId}/revision-work/${encodeURIComponent(revision.work.id)}/accept`,
      { content: acceptedContent }
    );

    expect(acceptResponse.status).toBe(200);
    expect(await acceptResponse.json()).toMatchObject({
      kind: "collaborative",
      status: "integrated",
      work: { id: revision.work.id, status: "integrated" },
      unit: { id: unitId, content: acceptedContent, version: 5 },
    });
    expect(await getUnit(projectId, unitId)).toMatchObject({
      content: acceptedContent,
      version: 5,
    });
    expect((await getWorkspace(projectId)).manuscript).toMatchObject({
      tree: [{
        children: [{
          plan: [{ unitId, unitVersion: 5 }],
          children: [{ kind: "leaf", unitId, version: 5 }],
        }],
      }],
    });

    const readings = await listAutomaticDiffractiveReadings(projectId, sectionId);
    expect(readings).toHaveLength(1);
    expect(readings[0]).toMatchObject({
      projectId,
      sectionId,
      trigger: "text_changed",
    });

    const repeatedAccept = await postJson(
      app,
      `/api/projects/${projectId}/units/${unitId}/revision-work/${encodeURIComponent(revision.work.id)}/accept`,
      { content: acceptedContent }
    );
    expect(repeatedAccept.status).toBe(200);
    expect(await getUnit(projectId, unitId)).toMatchObject({
      content: acceptedContent,
      version: 5,
    });
    expect(await listAutomaticDiffractiveReadings(projectId, sectionId)).toHaveLength(1);
    expect(await exists(legacyProposalPath(dataDir))).toBe(false);
  });

  it("keeps an applied Integration successful when downstream scheduling fails", async () => {
    await seed(dataDir, true);
    const current = await getUnit(projectId, unitId);
    expect(current).toBeDefined();
    await setUnits(projectId, [
      DraftUnitSchema.parse({
        ...current!,
        contextInPlan: { section: "missing-scheduler-section" },
      }),
    ]);
    const app = testApp(dataDir);
    const revision = await requestCollaborativeRevision(app);

    const acceptedContent = "Applied despite scheduler failure.";
    const acceptResponse = await postJson(
      app,
      `/api/projects/${projectId}/units/${unitId}/revision-work/${encodeURIComponent(revision.work.id)}/accept`,
      { content: acceptedContent }
    );

    expect(acceptResponse.status).toBe(200);
    expect(await acceptResponse.json()).toMatchObject({
      kind: "collaborative",
      status: "integrated",
      unit: { id: unitId, content: acceptedContent, version: 5 },
    });
    expect(await getUnit(projectId, unitId)).toMatchObject({
      content: acceptedContent,
      version: 5,
      contextInPlan: { section: "missing-scheduler-section" },
    });
    expect(await exists(legacyProposalPath(dataDir))).toBe(false);
  });
});
