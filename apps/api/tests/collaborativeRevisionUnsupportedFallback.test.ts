import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DraftUnitSchema, ManuscriptSchema } from "@auto-essay/core";
import { MockClient } from "../src/llm/mockClient.js";
import { putWorkspace } from "../src/services/editorialWorkspaceStore.js";
import { setUnits } from "../src/services/unitStore.js";
import { makeTempDataDir, makeTestApp, postJson } from "./helper.js";

const projectId = "project-revision-unsupported";
const unitId = "unit-revision-unsupported";
const createdAt = "2026-09-12T12:00:00.000Z";

async function seedUnsupportedMountedParagraph(dataDir: string): Promise<void> {
  process.env.AUTO_ESSAY_DATA_DIR = dataDir;
  const unit = DraftUnitSchema.parse({
    id: unitId,
    projectId,
    granularity: "paragraph",
    targetWordCount: 180,
    contextInPlan: { section: "section-revision-unsupported" },
    evidencePack: { sourceIds: [] },
    content: "Canonical paragraph.",
    claimIds: [],
    citationUses: [],
    appliedDecisionIds: [],
    appliedArticulationIds: [],
    transformationTraceIds: [],
    status: "drafting",
    version: 2,
    createdAt,
    updatedAt: createdAt,
  });
  const manuscript = ManuscriptSchema.parse({
    id: "manuscript-revision-unsupported",
    projectId,
    title: "Unsupported revision target",
    tree: [
      {
        kind: "node",
        id: "chapter-revision-unsupported",
        title: "Chapter",
        children: [
          {
            kind: "node",
            id: "section-revision-unsupported",
            title: "Section",
            children: [
              {
                kind: "node",
                id: "subsection-revision-unsupported",
                title: "Subsection",
                children: [{ kind: "leaf", unitId, version: 2 }],
              },
            ],
          },
        ],
      },
    ],
    createdAt,
    updatedAt: createdAt,
  });

  await setUnits(projectId, [unit]);
  await putWorkspace(projectId, {
    manuscript,
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

describe("AE2 unsupported revise-chat authority fallback", () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = makeTempDataDir();
  });

  afterEach(async () => {
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  it("keeps a mounted paragraph that #168 cannot project on the legacy path", async () => {
    await seedUnsupportedMountedParagraph(dataDir);
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
      sourceVersion: 2,
      before: "Canonical paragraph.",
      status: "available",
    });
    expect(body).not.toHaveProperty("kind");
    expect(
      await exists(path.join(dataDir, projectId, "revision-proposals.json"))
    ).toBe(true);
  });
});
