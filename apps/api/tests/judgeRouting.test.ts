import { describe, expect, it } from "vitest";
import { makeTempDataDir, makeTestApp, postJson } from "./helper";
import { MockClient } from "../src/llm/mockClient";

const validPolicy = {
  judges: [
    {
      id: "judge-documentary",
      role: "judge" as const,
      model: "documentary-judge-model",
      specialties: ["documentary_evaluation" as const],
    },
    {
      id: "judge-editorial",
      role: "judge" as const,
      model: "editorial-judge-model",
      specialties: ["editorial_effect_evaluation" as const],
    },
  ],
};

describe("judge routing routes", () => {
  it("previews both assignments and records the documentary judge used by an explicit evaluation", async () => {
    let modelFactoryCalls = 0;
    const app = makeTestApp(makeTempDataDir(), {
      judgeRoutingPolicy: validPolicy,
      modelClientFactory: async () => {
        modelFactoryCalls += 1;
        return new MockClient();
      },
    });
    const { project } = (await (await postJson(app, "/api/projects", { title: "Projet de jugement" })).json()) as {
      project: { id: string };
    };
    const { unit } = (await (
      await postJson(app, `/api/projects/${project.id}/units`, {
        section: "Section",
        content: "Cette lecture compare une source située et une interprétation prudente [1].",
      })
    ).json()) as { unit: { id: string } };

    const preview = await app.request(`/api/projects/${project.id}/units/${unit.id}/evaluate/judges`);
    expect(preview.status).toBe(200);
    expect(await preview.json()).toMatchObject({
      assignments: {
        documentary: {
          workType: "documentary_evaluation",
          judge: { id: "judge-documentary", model: "documentary-judge-model" },
        },
        editorial: {
          workType: "editorial_effect_evaluation",
          judge: { id: "judge-editorial", model: "editorial-judge-model" },
        },
      },
    });
    expect(modelFactoryCalls).toBe(0);

    const evaluated = await app.request(`/api/projects/${project.id}/units/${unit.id}/evaluate`, {
      method: "POST",
    });
    expect(evaluated.status).toBe(200);
    expect(await evaluated.json()).toMatchObject({
      evaluation: { evaluatorModel: "documentary-judge-model" },
      assignments: {
        documentary: { judge: { id: "judge-documentary" } },
        editorial: { judge: { id: "judge-editorial" } },
      },
    });
    expect(modelFactoryCalls).toBe(1);
  });

  it("rejects ambiguous routing before obtaining a model client", async () => {
    let modelFactoryCalls = 0;
    const app = makeTestApp(makeTempDataDir(), {
      judgeRoutingPolicy: {
        judges: [
          ...validPolicy.judges,
          { ...validPolicy.judges[0], id: "judge-documentary-duplicate" },
        ],
      },
      modelClientFactory: async () => {
        modelFactoryCalls += 1;
        return new MockClient();
      },
    });
    const { project } = (await (await postJson(app, "/api/projects", { title: "Projet ambigu" })).json()) as {
      project: { id: string };
    };
    const { unit } = (await (
      await postJson(app, `/api/projects/${project.id}/units`, { section: "Section" })
    ).json()) as { unit: { id: string } };

    const response = await app.request(`/api/projects/${project.id}/units/${unit.id}/evaluate/judges`);

    expect(response.status).toBe(400);
    expect(modelFactoryCalls).toBe(0);
  });
});
