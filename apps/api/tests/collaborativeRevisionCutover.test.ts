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
import { putWorkspace } from "../src/services/editorialWorkspaceStore.js";
import { loadCollaborativeRevisionWork } from "../src/services/collaborativeRevisionWorkStore.js";
import { getUnit, setUnits } from "../src/services/unitStore.js";
import { makeTempDataDir, makeTestApp, postJson } from "./helper.js";

const projectId = "project-revision-cutover";
const unitId = "unit-revision-cutover";
const createdAt = "2026-09-12T12:00:00.000Z";

function fixture(mounted: boolean): { manuscript: Manuscript; unit: DraftUnit } {
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
            id: "section-revision-cutover",
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

async function seed(dataDir: string, mounted: boolean): Promise<void> {
  process.env.AUTO_ESSAY_DATA_DIR = dataDir;
  const source = fixture(mounted);
  await setUnits(projectId, [source.unit]);
  await putWorkspace(projectId, {
    manuscript: source.manuscript,
    distribution: [],
    profiles: [],
    articulations: [],
  });
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
    const app = makeTestApp(dataDir, {
      modelClientFactory: async () => new MockClient(),
    });

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
    const app = makeTestApp(dataDir, {
      modelClientFactory: async () => new MockClient(),
    });

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
    const app = makeTestApp(dataDir, {
      modelClientFactory: async () => new MockClient(),
    });

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
});
