import { describe, expect, it } from "vitest";
import { createContentStyleArticulation } from "@auto-essay/core";
import { MockClient } from "../src/llm/mockClient.js";
import { makeTempDataDir, makeTestApp } from "./helper.js";

describe("read-only diffraction routes", () => {
  it("returns only a reading from the generic diffraction route", async () => {
    let modelFactoryCalls = 0;
    const app = makeTestApp(makeTempDataDir(), {
      modelClientFactory: async () => {
        modelFactoryCalls += 1;
        return {
          complete: async () =>
            JSON.stringify({
              pass1: { refraction: [] },
              pass2: { namedPatterns: [], revealedDefaults: [] },
              pass3: { entanglements: [] },
              pass4: {
                cut: "Ne pas changer la structure.",
                included: [],
                excluded: [],
                cutOfNonAdoption: [],
              },
              verdict: "archive",
              verdictDetail: "Conserver cette piste pour plus tard.",
              action: "Archiver la lecture.",
            }),
          completeStream: async () => undefined,
        };
      },
    });

    const response = await app.request("/api/diffract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statement: "Une position en formation." }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      fragment: { statement: "Une position en formation." },
      verdict: "archive",
    });
    expect(modelFactoryCalls).toBe(1);
  });

  it("does not expose a pipeline that combines a reading with an editorial decision", async () => {
    let modelFactoryCalls = 0;
    const app = makeTestApp(makeTempDataDir(), {
      modelClientFactory: async () => {
        modelFactoryCalls += 1;
        return new MockClient();
      },
    });
    const articulation = createContentStyleArticulation({
      scope: { level: "project", projectId: "project-1" },
      contentRelationIds: ["relation-1"],
      stylisticOperations: [
        {
          family: "tone_lexicon",
          category: "conceptual_lexicon",
          operation: "Reformuler la temporalité.",
          target: "narrator_voice",
          rationale: "Nommer la coupe.",
        },
      ],
      intendedEffects: {
        content: ["Reformuler la temporalité."],
        form: ["Rendre la voix narrative visible."],
      },
      origin: "system_proposed",
    });

    const response = await app.request("/api/diffract/pipeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fragment: { statement: "Une position en formation." },
        articulation,
        commitments: {
          contentCommitments: ["Conserver la tension."],
          formalCommitments: ["Ralentir le rythme."],
        },
      }),
    });

    expect(response.status).toBe(404);
    expect(modelFactoryCalls).toBe(0);
  });
});
