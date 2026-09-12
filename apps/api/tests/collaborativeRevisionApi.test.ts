import fs from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DraftUnitSchema,
  ManuscriptSchema,
  type DraftUnit,
  type Manuscript,
} from "@auto-essay/core";
import { makeTempDataDir, makeTestApp, postJson } from "./helper.js";
import { putWorkspace } from "../src/services/editorialWorkspaceStore.js";
import { getUnit, setUnits } from "../src/services/unitStore.js";
import {
  acceptCollaborativeParagraphRevision,
  captureCollaborativeRevisionSource,
  createCollaborativeParagraphRevision,
} from "../src/services/collaborativeRevisionWork.js";
import { integrateCollaborativeParagraphRevision } from "../src/services/collaborativeRevisionIntegration.js";

const projectId = "project-revision-api";
const unitId = "unit-revision-api";
const createdAt = "2026-09-12T10:00:00.000Z";

function fixture(): { manuscript: Manuscript; unit: DraftUnit } {
  const unit = DraftUnitSchema.parse({
    id: unitId,
    projectId,
    granularity: "paragraph",
    targetWordCount: 180,
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
    id: "manuscript-revision-api",
    projectId,
    title: "Revision API essay",
    tree: [
      {
        kind: "node",
        id: "chapter-revision-api",
        title: "Chapter",
        children: [
          {
            kind: "node",
            id: "section-revision-api",
            title: "Section",
            plan: [
              {
                id: "paragraph-revision-api",
                subject: "Paragraph",
                unitId,
                unitVersion: 4,
                notes: [],
              },
            ],
            children: [{ kind: "leaf", unitId, version: 4 }],
          },
        ],
      },
    ],
    createdAt,
    updatedAt: createdAt,
  });
  return { manuscript, unit };
}

async function seed(dataDir: string): Promise<void> {
  process.env.AUTO_ESSAY_DATA_DIR = dataDir;
  const source = fixture();
  await setUnits(projectId, [source.unit]);
  await putWorkspace(projectId, {
    manuscript: source.manuscript,
    distribution: [],
    profiles: [],
    articulations: [],
  });
}

async function createWork(proposedContent = "Proposed collaborative revision.") {
  const source = await captureCollaborativeRevisionSource(projectId, unitId);
  expect(source.authority).toBe("collaborative-core");
  if (source.authority !== "collaborative-core") throw new Error("expected collaborative source");
  const created = await createCollaborativeParagraphRevision({
    projectId,
    source,
    proposedContent,
  });
  expect(created.status).toBe("created");
  if (created.status !== "created") throw new Error("expected created work");
  return created.work;
}

describe("AE2 collaborative revision-work HTTP API", () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = makeTempDataDir();
    await seed(dataDir);
  });

  afterEach(async () => {
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  it("accepts edited collaborative work and materializes exactly one canonical next version", async () => {
    const work = await createWork();
    const app = makeTestApp(dataDir);

    const response = await postJson(
      app,
      `/api/projects/${projectId}/units/${unitId}/revision-work/${encodeURIComponent(work.id)}/accept`,
      { content: "Author-edited collaborative revision." }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      kind: "collaborative",
      status: "integrated",
      work: {
        id: work.id,
        unitId,
        status: "integrated",
        proposedContent: "Author-edited collaborative revision.",
      },
      unit: {
        id: unitId,
        content: "Author-edited collaborative revision.",
        version: 5,
      },
    });
    expect(body.work).not.toHaveProperty("workspaceId");
    expect(body.work).not.toHaveProperty("baseRevisionId");
    expect((await getUnit(projectId, unitId))?.version).toBe(5);
  });

  it("rejects collaborative work without mutating canonical content", async () => {
    const work = await createWork();
    const app = makeTestApp(dataDir);

    const response = await postJson(
      app,
      `/api/projects/${projectId}/units/${unitId}/revision-work/${encodeURIComponent(work.id)}/reject`,
      {}
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      kind: "collaborative",
      status: "rejected",
      work: { id: work.id, unitId, status: "rejected" },
    });
    expect(await getUnit(projectId, unitId)).toMatchObject({
      content: "Canonical paragraph.",
      version: 4,
    });
  });

  it("maps scope mismatch to a stable conflict response", async () => {
    const work = await createWork();
    const app = makeTestApp(dataDir);

    const response = await postJson(
      app,
      `/api/projects/${projectId}/units/wrong-unit/revision-work/${encodeURIComponent(work.id)}/accept`,
      { content: work.proposedContent }
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      kind: "collaborative",
      status: "scope_mismatch",
    });
  });

  it("returns backend stale/conflict assessment without client-style canonical mutation", async () => {
    const work = await createWork();
    const current = await getUnit(projectId, unitId);
    await setUnits(projectId, [
      DraftUnitSchema.parse({
        ...current!,
        content: "Concurrent autosave content.",
        updatedAt: "2026-09-12T10:05:00.000Z",
      }),
    ]);
    const app = makeTestApp(dataDir);

    const response = await postJson(
      app,
      `/api/projects/${projectId}/units/${unitId}/revision-work/${encodeURIComponent(work.id)}/accept`,
      { content: work.proposedContent }
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.kind).toBe("collaborative");
    expect(body.status).toBe("stale");
    expect(body.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: expect.stringMatching(/version|textual/) }),
      ])
    );
    expect(await getUnit(projectId, unitId)).toMatchObject({
      content: "Concurrent autosave content.",
      version: 4,
    });
  });

  it("maps recovery divergence to a stable recovery failure", async () => {
    const work = await createWork();
    await acceptCollaborativeParagraphRevision({
      projectId,
      unitId,
      workId: work.id,
      content: work.proposedContent,
    });
    await expect(
      integrateCollaborativeParagraphRevision({
        projectId,
        unitId,
        workId: work.id,
        faultInjection: async (point) => {
          if (point === "after_core_integrated_receipt") {
            throw new Error("simulated interruption");
          }
        },
      })
    ).rejects.toThrow("simulated interruption");

    const current = await getUnit(projectId, unitId);
    await setUnits(projectId, [
      DraftUnitSchema.parse({
        ...current!,
        content: "Unexpected third state.",
        version: 6,
        updatedAt: "2026-09-12T10:10:00.000Z",
      }),
    ]);
    const app = makeTestApp(dataDir);

    const response = await postJson(
      app,
      `/api/projects/${projectId}/units/${unitId}/revision-work/${encodeURIComponent(work.id)}/accept`,
      { content: work.proposedContent }
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      kind: "collaborative",
      status: "recovery_failed",
      code: "canonical_diverged",
    });
    expect(await getUnit(projectId, unitId)).toMatchObject({
      content: "Unexpected third state.",
      version: 6,
    });
  });
});
