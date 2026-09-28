import fs from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSource,
  createManuscript,
  createManuscriptLeaf,
  createManuscriptNode,
  createPlanningBrief,
  SourceProfileSchema,
  DiffractiveReadingSchema,
} from "@auto-essay/core";
import { makeTempDataDir, makeTestApp, postJson, patchJson } from "./helper.js";
import {
  putWorkspace,
  savePlanningBrief,
  storeReading,
} from "../src/services/editorialWorkspaceStore.js";
import { setSources } from "../src/services/sourceStore.js";
import { createUnit, updateUnit } from "../src/services/unitStore.js";
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});
function setup() {
  const dir = makeTempDataDir();
  directories.push(dir);
  process.env.AUTO_ESSAY_DATA_DIR = dir;
  return makeTestApp(dir);
}
describe("reference workspace API contracts", () => {
  it("projects real source comprehension states without treating a bibliographic notice as explored", async () => {
    const app = setup();
    const source = createSource({
      projectId: "p",
      title: "Archive",
      content: "Le document.",
    });
    const notice = createSource({
      projectId: "p",
      title: "Notice seule",
      content: "",
    });
    await setSources("p", [source, notice]);
    await putWorkspace("p", {
      manuscript: createManuscript({
        projectId: "p",
        title: "Essai",
        tree: [],
      }),
      distribution: [],
      articulations: [],
      profiles: [
        SourceProfileSchema.parse({
          sourceId: source.id,
          subjects: [],
          concepts: [],
          comprehension: {
            totalBlocks: 2,
            coveredBlockIds: ["1", "2"],
            excludedBlockIds: [],
            status: "ready",
          },
        }),
      ],
    });
    const response = await app.request("/api/projects/p/sources/overview");
    expect(response.status).toBe(200);
    const { sources } = await response.json();
    expect(sources.map((item: { state: string }) => item.state)).toEqual([
      "explored",
      "registered_unexplored",
    ]);
    const context = await app.request(
      `/api/projects/p/scope-context/source/${source.id}`,
    );
    expect((await context.json()).sources[0].state).toBe("explored");
  });
  it("supports source conversation, notes and empty-library workflows without a manuscript", async () => {
    const app = setup();
    const source = createSource({
      projectId: "p",
      title: "Archive",
      content: "Une information propre à cette source.",
    });
    await setSources("p", [source]);
    const complete = vi
      .fn()
      .mockResolvedValue("Réponse fondée sur le document.");
    const chatApp = makeTestApp(undefined, {
      modelClientFactory: async () => ({ complete, completeStream: vi.fn() }),
    });
    const response = await postJson(
      chatApp,
      `/api/projects/p/scope-conversation/source/${source.id}`,
      { message: "Que contient ce document ?" },
    );
    expect(response.status).toBe(201);
    expect(complete.mock.calls[0]?.[1]).toContain(source.content);
    const journal = await chatApp.request(
      `/api/projects/p/scope-conversation/source/${source.id}`,
    );
    expect((await journal.json()).messages).toHaveLength(2);
    const note = {
      id: "note-1",
      sourceId: source.id,
      content: "À relire",
      tags: [],
    };
    expect(
      (
        await patchJson(app, `/api/projects/p/sources/${source.id}`, {
          annotations: [note],
        })
      ).status,
    ).toBe(200);
    expect(
      (await (await app.request(`/api/projects/p/sources/${source.id}`)).json())
        .source.annotations,
    ).toEqual([note]);
    const invalidSelection = await app.request(
      `/api/projects/p/scope-context/source/${source.id}/sources/${source.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ included: true }),
      },
    );
    expect(invalidSelection.status).toBe(409);
    expect(
      (await app.request("/api/projects/p/scope-conversation/source/missing"))
        .status,
    ).toBe(404);
    const unit = await createUnit("p", {
      thesis: "Passage autonome",
      content: "Texte",
      granularity: "paragraph",
    });
    expect(
      (await app.request(`/api/projects/p/scope-context/unit/${unit.id}`))
        .status,
    ).toBe(200);
  });
  it("feeds the agent and analysis from the same real planning and evidence context", async () => {
    setup();
    const source = createSource({
      projectId: "p",
      title: "Archive située",
      content: "Le document.",
    });
    await setSources("p", [source]);
    const node = createManuscriptNode({
      id: "chapter",
      title: "Chapitre",
      text: "Texte courant",
    });
    const manuscript = createManuscript({
      projectId: "p",
      title: "Essai",
      tree: [node],
    });
    await putWorkspace("p", {
      manuscript,
      distribution: [],
      articulations: [],
      profiles: [],
    });
    await savePlanningBrief(
      "p",
      createPlanningBrief({
        manuscript,
        scopeRef: {
          kind: "node",
          projectId: "p",
          manuscriptId: manuscript.id,
          nodeId: node.id,
        },
        question: "Quelle continuité ?",
        sourceRefs: [source.id],
        hypotheses: [
          {
            statement: "Une hypothèse documentée",
            status: "under_documented",
            sourceRefs: [source.id],
          },
        ],
        gaps: [
          {
            description: "Archives locales manquantes",
            consequence: "Comparaison limitée",
          },
        ],
      }),
    );
    const complete = vi.fn().mockResolvedValue("Réponse située.");
    const app = makeTestApp(undefined, {
      modelClientFactory: async () => ({ complete, completeStream: vi.fn() }),
    });
    const context = await (
      await app.request("/api/projects/p/scope-context/node/chapter")
    ).json();
    expect(context.planning.hypotheses[0].status).toBe("under_documented");
    expect(context.exploration.gaps[0].description).toBe(
      "Archives locales manquantes",
    );
    expect(context.readings).toEqual([]);
    expect(
      (
        await postJson(app, "/api/projects/p/scope-conversation/node/chapter", {
          message: "Quelles sources sont mobilisées ?",
        })
      ).status,
    ).toBe(201);
    expect(complete.mock.calls[0]?.[1]).toContain("Archive située");
    expect(complete.mock.calls[0]?.[1]).toContain("Quelle continuité ?");
  });
  it("aggregates child evidence with provenance while keeping chapter source selection independent", async () => {
    const app = setup();
    const source = createSource({
      projectId: "p",
      title: "Archive citée",
      content: "Un extrait.",
    });
    await setSources("p", [source]);
    const unit = await createUnit("p", {
      granularity: "paragraph",
      content: "Le texte.",
      evidencePack: {
        sourceIds: [source.id],
        keyCitations: [
          { sourceId: source.id, quote: "Un extrait.", context: "Argument" },
        ],
        supportingClaimIds: [],
        objections: [],
      },
    });
    const node = createManuscriptNode({
      id: "chapter",
      title: "Chapitre",
      children: [
        createManuscriptNode({
          id: "section",
          title: "Section",
          children: [createManuscriptLeaf(unit.id, unit.version)],
        }),
      ],
    });
    const manuscript = createManuscript({
      projectId: "p",
      title: "Essai",
      tree: [node],
    });
    await putWorkspace("p", {
      manuscript,
      distribution: [],
      articulations: [],
      profiles: [],
    });
    await savePlanningBrief(
      "p",
      createPlanningBrief({
        manuscript,
        scopeRef: {
          kind: "node",
          projectId: "p",
          manuscriptId: manuscript.id,
          nodeId: node.id,
        },
        question: "Question ?",
        sourceRefs: [],
      }),
    );
    await storeReading("p", {
      scopeId: "section",
      scope: {
        kind: "paragraph",
        sectionId: "section",
        unitId: unit.id,
        unitVersion: unit.version,
      },
      reading: DiffractiveReadingSchema.parse({
        id: "reading",
        fragment: { statement: "Texte antérieur", claimIds: [], sourceIds: [] },
        pass1: { refraction: [] },
        pass2: { namedPatterns: [], revealedDefaults: [] },
        pass3: { entanglements: [] },
        pass4: {
          cut: "Conserver",
          included: [],
          excluded: [],
          cutOfNonAdoption: [],
        },
        verdict: "integrate_now",
        verdictDetail: "Lecture enregistrée",
        action: "Relire",
        tradeoffs: [],
        planImpacts: [],
        bibliographyImpacts: [],
        createdAt: new Date().toISOString(),
      }),
    });
    await updateUnit("p", unit.id, {
      content: "Texte modifié sans changement de version.",
    });
    const unitContext = await (
      await app.request(`/api/projects/p/scope-context/unit/${unit.id}`)
    ).json();
    expect(unitContext.readings[0].freshness).toBe("unverified");
    const context = await (
      await app.request("/api/projects/p/scope-context/node/chapter")
    ).json();
    expect(context.passages).toEqual([
      expect.objectContaining({
        sourceId: source.id,
        text: "Un extrait.",
        unitId: unit.id,
      }),
    ]);
    expect(context.sources[0]).toMatchObject({
      included: false,
      usedInDescendants: true,
    });
    const complete = vi.fn().mockResolvedValue("Réponse documentaire.");
    const chatApp = makeTestApp(undefined, {
      modelClientFactory: async () => ({ complete, completeStream: vi.fn() }),
    });
    await postJson(chatApp, "/api/projects/p/scope-conversation/node/chapter", {
      message: "Quelles archives étayent les passages ?",
    });
    expect(complete.mock.calls[0]?.[1]).toContain(source.title);
    expect(complete.mock.calls[0]?.[1]).toContain("Un extrait.");

    for (const included of [true, false]) {
      const response = await app.request(
        `/api/projects/p/scope-context/node/chapter/sources/${source.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ included }),
        },
      );
      expect(response.status).toBe(200);
      const overview = await (
        await app.request("/api/projects/p/sources/overview")
      ).json();
      expect(overview.sources[0].nodeLinks).toEqual(
        included ? [{ id: "chapter", title: "Chapitre" }] : [],
      );
      const updated = await response.json();
      expect(updated.sources[0].usedInDescendants).toBe(true);
      expect(updated.passages).toHaveLength(1);
    }
  });
});
