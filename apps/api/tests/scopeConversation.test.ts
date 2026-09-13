import fs from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createManuscript, createManuscriptNode } from "@auto-essay/core";
import { makeTempDataDir, makeTestApp, postJson } from "./helper.js";
import { putWorkspace } from "../src/services/editorialWorkspaceStore.js";
import { createUnit } from "../src/services/unitStore.js";
import type { ModelClientFactory } from "../src/llm/client.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("scope conversation", () => {
  it("restores the journal for the same unit scope without leaking another scope", async () => {
    const dataDir = makeTempDataDir();
    directories.push(dataDir);
    process.env.AUTO_ESSAY_DATA_DIR = dataDir;
    const first = await createUnit("project-1", {
      granularity: "paragraph",
      thesis: "Premier paragraphe",
      content: "Texte du premier paragraphe.",
    });
    const second = await createUnit("project-1", {
      granularity: "paragraph",
      thesis: "Deuxième paragraphe",
      content: "Texte du deuxième paragraphe.",
    });
    const complete = vi.fn()
      .mockResolvedValueOnce("Réponse pour le premier scope.")
      .mockResolvedValueOnce("Réponse pour le second scope.")
      .mockResolvedValueOnce("Suite du premier scope.");
    const modelClientFactory = modelFactory(complete);
    const app = makeTestApp(dataDir, { modelClientFactory });

    const firstResponse = await postJson(
      app,
      `/api/projects/project-1/scope-conversation/unit/${first.id}`,
      { message: "Question A" }
    );
    expect(firstResponse.status).toBe(201);

    const secondResponse = await postJson(
      app,
      `/api/projects/project-1/scope-conversation/unit/${second.id}`,
      { message: "Question B" }
    );
    expect(secondResponse.status).toBe(201);

    const resumedResponse = await postJson(
      app,
      `/api/projects/project-1/scope-conversation/unit/${first.id}`,
      { message: "Question A2" }
    );
    expect(resumedResponse.status).toBe(201);
    const resumed = await resumedResponse.json();
    expect(resumed.messages.map((message: { role: string; content: string }) => [message.role, message.content])).toEqual([
      ["author", "Question A"],
      ["autoessay", "Réponse pour le premier scope."],
      ["author", "Question A2"],
      ["autoessay", "Suite du premier scope."],
    ]);

    const firstJournal = await app.request(
      `/api/projects/project-1/scope-conversation/unit/${first.id}`
    );
    expect(firstJournal.status).toBe(200);
    expect((await firstJournal.json()).messages).toHaveLength(4);

    const secondJournal = await app.request(
      `/api/projects/project-1/scope-conversation/unit/${second.id}`
    );
    expect(secondJournal.status).toBe(200);
    expect((await secondJournal.json()).messages).toHaveLength(2);

    const secondPrompt = complete.mock.calls[1]?.[1] as string;
    expect(secondPrompt).toContain("Question B");
    expect(secondPrompt).not.toContain("Question A");
    const resumedPrompt = complete.mock.calls[2]?.[1] as string;
    expect(resumedPrompt).toContain("Question A");
    expect(resumedPrompt).toContain("Réponse pour le premier scope.");
    expect(resumedPrompt).not.toContain("Question B");
  });

  it("binds a conversation to an existing manuscript node", async () => {
    const dataDir = makeTempDataDir();
    directories.push(dataDir);
    process.env.AUTO_ESSAY_DATA_DIR = dataDir;
    const chapter = createManuscriptNode({
      id: "chapter-1",
      title: "Chapitre situé",
      text: "Contexte propre au chapitre.",
    });
    const manuscript = createManuscript({
      projectId: "project-1",
      title: "Essai",
      tree: [chapter],
    });
    await putWorkspace("project-1", {
      manuscript,
      distribution: [],
      profiles: [],
      articulations: [],
    });
    const complete = vi.fn().mockResolvedValue("Réponse sur le chapitre.");
    const app = makeTestApp(dataDir, { modelClientFactory: modelFactory(complete) });

    const response = await postJson(
      app,
      "/api/projects/project-1/scope-conversation/node/chapter-1",
      { message: "Que faut-il clarifier ici ?" }
    );

    expect(response.status).toBe(201);
    expect((await response.json()).messages).toHaveLength(2);
    expect(complete.mock.calls[0]?.[1]).toContain("Chapitre situé");
    expect(complete.mock.calls[0]?.[1]).toContain("Contexte propre au chapitre.");
  });

  it("rejects a conversation for an unknown scope", async () => {
    const dataDir = makeTempDataDir();
    directories.push(dataDir);
    const app = makeTestApp(dataDir, { modelClientFactory: modelFactory(vi.fn()) });

    const response = await app.request(
      "/api/projects/project-1/scope-conversation/unit/missing"
    );

    expect(response.status).toBe(404);
  });
});

function modelFactory(complete: ReturnType<typeof vi.fn>): ModelClientFactory {
  return async () => ({
    complete,
    completeStream: vi.fn(),
  });
}
