import { describe, expect, it } from "vitest";
import { makeTempDataDir, makeTestApp, postJson } from "./helper";

describe("chapter operation routes", () => {
  it("persists explicit chapter operation transitions without calling a model", async () => {
    let modelFactoryCalls = 0;
    const app = makeTestApp(makeTempDataDir(), {
      modelClientFactory: async () => {
        modelFactoryCalls += 1;
        return {
          complete: async () => "{}",
          completeStream: async () => undefined,
        };
      },
    });
    const projectResponse = await postJson(app, "/api/projects", { title: "Projet opérations" });
    const { project } = (await projectResponse.json()) as { project: { id: string } };

    const created = await postJson(
      app,
      `/api/projects/${project.id}/editorial/chapter-operations`,
      { chapterId: "chapter-1" }
    );
    expect(created.status).toBe(201);
    const { operation } = (await created.json()) as { operation: { id: string; state: string; trace: unknown[] } };
    expect(operation).toMatchObject({ state: "preparing", trace: [{ type: "created", actor: "author" }] });

    const awaiting = await postJson(
      app,
      `/api/projects/${project.id}/editorial/chapter-operations/${operation.id}/await-author`,
      {}
    );
    expect(awaiting.status).toBe(200);
    expect(await awaiting.json()).toMatchObject({ operation: { state: "awaiting_author" } });

    const started = await postJson(
      app,
      `/api/projects/${project.id}/editorial/chapter-operations/${operation.id}/start`,
      {}
    );
    expect(await started.json()).toMatchObject({ operation: { state: "running" } });

    const paused = await postJson(
      app,
      `/api/projects/${project.id}/editorial/chapter-operations/${operation.id}/pause`,
      { detail: "Vérification nécessaire" }
    );
    expect(await paused.json()).toMatchObject({ operation: { state: "paused" } });

    const resumed = await postJson(
      app,
      `/api/projects/${project.id}/editorial/chapter-operations/${operation.id}/resume`,
      {}
    );
    expect(await resumed.json()).toMatchObject({ operation: { state: "running" } });

    const cancelled = await postJson(
      app,
      `/api/projects/${project.id}/editorial/chapter-operations/${operation.id}/cancel`,
      { detail: "Arrêt demandé par l’auteur" }
    );
    expect(await cancelled.json()).toMatchObject({ operation: { state: "cancelled" } });

    const invalidResume = await postJson(
      app,
      `/api/projects/${project.id}/editorial/chapter-operations/${operation.id}/resume`,
      {}
    );
    expect(invalidResume.status).toBe(400);
    expect(modelFactoryCalls).toBe(0);
  });

  it("reports a missing operation explicitly", async () => {
    const app = makeTestApp(makeTempDataDir());
    const projectResponse = await postJson(app, "/api/projects", { title: "Projet opérations" });
    const { project } = (await projectResponse.json()) as { project: { id: string } };

    const response = await app.request(
      `/api/projects/${project.id}/editorial/chapter-operations/missing`
    );

    expect(response.status).toBe(404);
  });
});
