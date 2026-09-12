import { describe, expect, it } from "vitest";
import { setSources } from "../src/services/sourceStore.js";
import { makeTempDataDir, makeTestApp, postJson } from "./helper.js";

const now = "2026-09-13T00:00:00.000Z";

async function setup() {
  const app = makeTestApp(makeTempDataDir(), {
    modelClientFactory: async () => ({
      complete: async () => JSON.stringify({
        axes: [{
          label: "Archives concurrentes",
          question: "Qui stabilise la mémoire publique ?",
          rationale: "Deux régimes documentaires se confrontent.",
          evidence: [{ passageId: "source:source-1:content", role: "supports" }],
          limits: ["Exploration partielle"],
        }],
        subjects: [
          {
            title: "Archives en conflit",
            question: "Comment des archives concurrentes organisent-elles la mémoire ?",
            angle: "Confronter sans synthèse prématurée",
            hypotheses: ["Les archives institutionnelles stabilisent une mémoire"],
            distinctiveness: "Met au centre le conflit documentaire",
            evidence: [{ passageId: "source:source-1:content", role: "supports" }],
            limits: ["Corpus incomplet"],
          },
          {
            title: "Contre-archives",
            question: "Que déplacent les contre-archives ?",
            angle: "Suivre les déplacements de légitimité",
            hypotheses: ["Les contre-archives redistribuent l’autorité"],
            distinctiveness: "Part de la circulation de l’autorité",
            evidence: [{ passageId: "source:source-1:content", role: "context" }],
            limits: ["Témoignages à compléter"],
          },
        ],
      }),
      completeStream: async () => undefined,
    }),
  });
  const projectResponse = await postJson(app, "/api/projects", { title: "Plan V2 API" });
  const { project } = await projectResponse.json() as { project: { id: string } };
  const projectId = project.id;
  await app.request(`/api/projects/${projectId}/editorial/workspace`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      manuscript: {
        id: "manuscript-1",
        projectId,
        title: "Essai",
        createdAt: now,
        updatedAt: now,
        tree: [{ kind: "node", id: "chapter-1", title: "Chapitre 1", children: [] }],
      },
      distribution: [],
      profiles: [],
      articulations: [],
    }),
  });
  await setSources(projectId, [{
    id: "source-1",
    projectId,
    type: "note",
    title: "Archive",
    content: "Une archive institutionnelle organise la mémoire publique.",
    authors: [],
    annotations: [],
    epistemicLimits: [],
    tags: [],
    verificationStatus: "verified",
  }]);
  return { app, projectId };
}

describe("Plan V2 planning API", () => {
  it("keeps exploration coverage explicit and creates a versioned brief without a planning session", async () => {
    const { app, projectId } = await setup();

    const initial = await app.request(`/api/projects/${projectId}/planning/state?scopeKind=node&scopeId=chapter-1`);
    expect(initial.status).toBe(200);
    await expect(initial.json()).resolves.toMatchObject({
      manuscriptId: "manuscript-1",
      mode: "from_zero",
      coverage: {
        registeredSourceCount: 1,
        representedSourceCount: 1,
        explorationComplete: false,
      },
    });

    const explored = await postJson(app, `/api/projects/${projectId}/planning/explore`, {});
    expect(explored.status).toBe(200);
    const exploration = await explored.json() as { subjects: Array<Record<string, unknown>> };
    expect(exploration.subjects).toHaveLength(2);

    const created = await postJson(app, `/api/projects/${projectId}/planning/briefs/from-subject`, {
      scopeRef: {
        kind: "node",
        projectId,
        manuscriptId: "manuscript-1",
        nodeId: "chapter-1",
      },
      subject: exploration.subjects[0],
    });
    expect(created.status).toBe(201);
    const { brief } = await created.json() as { brief: { id: string; version: number } };
    expect(brief.version).toBe(1);

    const grill = await postJson(app, `/api/projects/${projectId}/planning/grill`, {
      briefId: brief.id,
      round: 0,
    });
    const grillBody = await grill.json() as { questions: unknown[] };
    expect(grill.status).toBe(200);
    expect(grillBody.questions.length).toBeLessThanOrEqual(3);

    const exhausted = await postJson(app, `/api/projects/${projectId}/planning/grill`, {
      briefId: brief.id,
      round: 2,
    });
    await expect(exhausted.json()).resolves.toMatchObject({ questions: [] });

    const superseded = await postJson(app, `/api/projects/${projectId}/planning/briefs/${brief.id}/supersede`, {
      question: "Question précisée par l’auteur",
    });
    expect(superseded.status).toBe(201);
    await expect(superseded.json()).resolves.toMatchObject({
      brief: { version: 2, supersedesBriefId: brief.id, question: "Question précisée par l’auteur" },
    });
  });
});
