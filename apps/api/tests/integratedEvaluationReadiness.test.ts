import { describe, expect, it } from "vitest";
import { makeTempDataDir, makeTestApp, postJson } from "./helper";
import { MockClient } from "../src/llm/mockClient";

describe("integrated evaluation readiness route", () => {
  it("reports a missing canonical context without obtaining a model client", async () => {
    let modelFactoryCalls = 0;
    const app = makeTestApp(makeTempDataDir(), {
      modelClientFactory: async () => {
        modelFactoryCalls += 1;
        return new MockClient();
      },
    });
    const { project } = (await (
      await postJson(app, "/api/projects", { title: "Préparabilité intégrée" })
    ).json()) as { project: { id: string } };
    const { unit } = (await (
      await postJson(app, `/api/projects/${project.id}/units`, { section: "Section libre" })
    ).json()) as { unit: { id: string } };

    const readiness = await app.request(
      `/api/projects/${project.id}/units/${unit.id}/evaluate/readiness`
    );

    expect(readiness.status).toBe(200);
    await expect(readiness.json()).resolves.toEqual({
      status: "unavailable",
      reasons: [{ code: "missing_context" }],
    });
    expect(modelFactoryCalls).toBe(0);
  });

  it("returns an empty integrated evaluation history without obtaining a model client", async () => {
    let modelFactoryCalls = 0;
    const app = makeTestApp(makeTempDataDir(), {
      modelClientFactory: async () => {
        modelFactoryCalls += 1;
        return new MockClient();
      },
    });
    const { project } = (await (
      await postJson(app, "/api/projects", { title: "Historique intégré" })
    ).json()) as { project: { id: string } };
    const { unit } = (await (
      await postJson(app, `/api/projects/${project.id}/units`, { section: "Section libre" })
    ).json()) as { unit: { id: string } };

    const history = await app.request(
      `/api/projects/${project.id}/units/${unit.id}/evaluate/integrated/history`
    );

    expect(history.status).toBe(200);
    await expect(history.json()).resolves.toEqual({ history: [] });
    expect(modelFactoryCalls).toBe(0);
  });

  it("rejects an explicit integrated evaluation without a ready context before obtaining a model client", async () => {
    let modelFactoryCalls = 0;
    const app = makeTestApp(makeTempDataDir(), {
      modelClientFactory: async () => {
        modelFactoryCalls += 1;
        return new MockClient();
      },
    });
    const { project } = (await (
      await postJson(app, "/api/projects", { title: "Refus intégré" })
    ).json()) as { project: { id: string } };
    const { unit } = (await (
      await postJson(app, `/api/projects/${project.id}/units`, { section: "Section libre" })
    ).json()) as { unit: { id: string } };

    const evaluated = await app.request(
      `/api/projects/${project.id}/units/${unit.id}/evaluate/integrated`,
      { method: "POST" }
    );

    expect(evaluated.status).toBe(400);
    await expect(evaluated.json()).resolves.toMatchObject({
      message: "integrated evaluation unavailable: missing_context",
    });
    expect(modelFactoryCalls).toBe(0);
  });
});
