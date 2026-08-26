import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { makeTestApp, makeTempDataDir, postJson } from "./helper.js";
import { MockClient } from "../src/llm/mockClient.js";
import fs from "node:fs/promises";

describe("integration flow", () => {
  let dataDir: string;
  let previousOpenAiKey: string | undefined;

  beforeEach(async () => {
    dataDir = makeTempDataDir();
    previousOpenAiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "test-key-that-must-not-be-used";
  });

  afterEach(async () => {
    if (previousOpenAiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = previousOpenAiKey;
    }
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  it("creates a project, imports a source, creates a unit, generates, revises and exports", async () => {
    const app = makeTestApp(dataDir, {
      modelClientFactory: async () => new MockClient(),
    });

    const { project } = await (
      await postJson(app, "/api/projects", { title: "Mon essai" })
    ).json();

    const mdContent = "---\ntitle: Source test\nauthor: A. Uteur\n---\n\n> Citation importante (p. 12)\n\nCorps de la source.";
    const importRes = await postJson(app, `/api/projects/${project.id}/sources/import`, {
      files: [{ name: "source.md", content: mdContent }],
    });
    expect(importRes.status).toBe(200);
    const importBody = await importRes.json();
    expect(importBody.imported).toBe(1);

    const { unit } = await (
      await postJson(app, `/api/projects/${project.id}/units`, { section: "Introduction" })
    ).json();
    expect(unit.content).toBe("");

    const genRes = await app.request(
      `/api/projects/${project.id}/units/${unit.id}/generate`,
      { method: "POST" }
    );
    expect(genRes.status).toBe(200);
    const { unit: generatedUnit } = await genRes.json();
    expect(generatedUnit.content.length).toBeGreaterThan(0);
    expect(generatedUnit.version).toBe(2);

    const reviseRes = await postJson(
      app,
      `/api/projects/${project.id}/units/${unit.id}/revise-chat`,
      { instruction: "Raccourcis le texte." }
    );
    expect(reviseRes.status).toBe(200);
    const reviseBody = await reviseRes.json();
    expect(reviseBody.after.length).toBeGreaterThan(0);

    const evalRes = await app.request(
      `/api/projects/${project.id}/units/${unit.id}/evaluate`,
      { method: "POST" }
    );
    expect(evalRes.status).toBe(200);
    const evalBody = await evalRes.json();
    expect(evalBody.evaluation.overallScore).toBeGreaterThan(0);
    expect(evalBody.brief.focusAreas.length).toBeGreaterThan(0);

    const exportRes = await postJson(app, `/api/projects/${project.id}/export`, {});
    expect(exportRes.status).toBe(200);
    const exportBody = await exportRes.json();
    expect(exportBody.markdown.length).toBeGreaterThan(0);
  });
});
