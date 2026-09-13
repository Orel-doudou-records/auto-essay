import fs from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import {
  EditorialDecisionSchema,
  SourceProfileSchema,
  createManuscript,
  createManuscriptLeaf,
  createManuscriptNode,
  createPlanningBrief,
  createSource,
} from "@auto-essay/core";
import { makeTempDataDir, makeTestApp } from "./helper.js";
import {
  listPlanningBriefs,
  mutateWorkspace,
  putWorkspace,
  savePlanningBrief,
} from "../src/services/editorialWorkspaceStore.js";
import { setSources, listSources } from "../src/services/sourceStore.js";
import { createUnit, getUnit } from "../src/services/unitStore.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("scope context", () => {
  it("keeps source state and selection isolated when the manuscript scope changes", async () => {
    const dataDir = makeTempDataDir();
    directories.push(dataDir);
    process.env.AUTO_ESSAY_DATA_DIR = dataDir;

    const explored = createSource({ projectId: "project-1", title: "Explorée", content: "Texte complet" });
    const partial = createSource({ projectId: "project-1", title: "Partielle", content: "Texte partiel" });
    const registered = createSource({ projectId: "project-1", title: "Enregistrée", content: "Texte brut" });
    const unusable = createSource({ projectId: "project-1", title: "Inutilisable", content: "" });
    await setSources("project-1", [explored, partial, registered, unusable]);

    const chapterA = createManuscriptNode({ id: "chapter-a", title: "Chapitre A", text: "Texte A" });
    const chapterB = createManuscriptNode({ id: "chapter-b", title: "Chapitre B", text: "Texte B" });
    const manuscript = createManuscript({
      projectId: "project-1",
      title: "Essai",
      tree: [chapterA, chapterB],
    });
    await putWorkspace("project-1", {
      manuscript,
      distribution: [],
      articulations: [],
      profiles: [
        SourceProfileSchema.parse({
          sourceId: explored.id,
          subjects: ["Sujet"],
          concepts: [],
          comprehension: {
            totalBlocks: 2,
            coveredBlockIds: ["e1", "e2"],
            excludedBlockIds: [],
            status: "ready",
          },
        }),
        SourceProfileSchema.parse({
          sourceId: partial.id,
          subjects: ["Sujet incomplet"],
          concepts: [],
          comprehension: {
            totalBlocks: 2,
            coveredBlockIds: ["p1"],
            excludedBlockIds: [],
            status: "degraded",
          },
        }),
        SourceProfileSchema.parse({
          sourceId: unusable.id,
          subjects: [],
          concepts: [],
          comprehension: {
            totalBlocks: 0,
            coveredBlockIds: [],
            excludedBlockIds: [],
            status: "unreadable",
          },
        }),
      ],
    });
    await savePlanningBrief("project-1", createPlanningBrief({
      manuscript,
      scopeRef: {
        kind: "node",
        projectId: "project-1",
        manuscriptId: manuscript.id,
        nodeId: chapterA.id,
      },
      question: "Question A ?",
      sourceRefs: [explored.id],
      gaps: [{ description: "Manque A", consequence: "Fragilise A" }],
    }));
    await savePlanningBrief("project-1", createPlanningBrief({
      manuscript,
      scopeRef: {
        kind: "node",
        projectId: "project-1",
        manuscriptId: manuscript.id,
        nodeId: chapterB.id,
      },
      question: "Question B ?",
      sourceRefs: [partial.id],
    }));
    const now = new Date().toISOString();
    await mutateWorkspace("project-1", (workspace) => {
      workspace.decisions.push(EditorialDecisionSchema.parse({
        id: "decision-a",
        projectId: "project-1",
        version: 1,
        scope: { level: "section", projectId: "project-1", sectionId: chapterA.id },
        articulationId: "articulation-a",
        contentCommitments: ["Conserver la tension A"],
        formalCommitments: ["Forme A"],
        validation: { validatedBy: "author", validatedAt: now },
        status: "active",
        createdAt: now,
        updatedAt: now,
      }));
    });

    const app = makeTestApp(dataDir);
    const responseA = await app.request("/api/projects/project-1/scope-context/node/chapter-a");
    expect(responseA.status).toBe(200);
    const contextA = await responseA.json();
    expect(contextA.text).toBe("Texte A");
    expect(contextA.planning.question).toBe("Question A ?");
    expect(contextA.decisions.map((decision: { id: string }) => decision.id)).toEqual(["decision-a"]);
    expect(Object.fromEntries(contextA.sources.map((source: { title: string; state: string }) => [source.title, source.state]))).toEqual({
      "Explorée": "explored",
      "Partielle": "partial",
      "Enregistrée": "registered_unexplored",
      "Inutilisable": "unusable",
    });
    expect(contextA.sources.find((source: { id: string }) => source.id === explored.id).included).toBe(true);
    expect(contextA.sources.find((source: { id: string }) => source.id === partial.id).included).toBe(false);
    expect(contextA.exploration.gaps[0].description).toBe("Manque A");

    const responseB = await app.request("/api/projects/project-1/scope-context/node/chapter-b");
    expect(responseB.status).toBe(200);
    const contextB = await responseB.json();
    expect(contextB.text).toBe("Texte B");
    expect(contextB.planning.question).toBe("Question B ?");
    expect(contextB.decisions).toEqual([]);
    expect(contextB.sources.find((source: { id: string }) => source.id === explored.id).included).toBe(false);
    expect(contextB.sources.find((source: { id: string }) => source.id === partial.id).included).toBe(true);
    expect(contextB.exploration.gaps).toEqual([]);
  });

  it("supersedes the planning brief when a node source is included or excluded", async () => {
    const dataDir = makeTempDataDir();
    directories.push(dataDir);
    process.env.AUTO_ESSAY_DATA_DIR = dataDir;
    const source = createSource({ projectId: "project-1", title: "Source", content: "Contenu" });
    await setSources("project-1", [source]);
    const node = createManuscriptNode({ id: "chapter-1", title: "Chapitre" });
    const manuscript = createManuscript({ projectId: "project-1", title: "Essai", tree: [node] });
    await putWorkspace("project-1", { manuscript, distribution: [], profiles: [], articulations: [] });
    await savePlanningBrief("project-1", createPlanningBrief({
      manuscript,
      scopeRef: {
        kind: "node",
        projectId: "project-1",
        manuscriptId: manuscript.id,
        nodeId: node.id,
      },
      question: "Question ?",
      sourceRefs: [],
    }));
    const app = makeTestApp(dataDir);

    const include = await app.request(
      `/api/projects/project-1/scope-context/node/${node.id}/sources/${source.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ included: true }),
      }
    );
    expect(include.status).toBe(200);
    expect((await include.json()).sources.find((item: { id: string }) => item.id === source.id).included).toBe(true);

    const exclude = await app.request(
      `/api/projects/project-1/scope-context/node/${node.id}/sources/${source.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ included: false }),
      }
    );
    expect(exclude.status).toBe(200);
    expect((await exclude.json()).sources.find((item: { id: string }) => item.id === source.id).included).toBe(false);

    const briefs = (await listPlanningBriefs("project-1")).sort((a, b) => a.version - b.version);
    expect(briefs.map((brief) => brief.version)).toEqual([1, 2, 3]);
    expect(briefs[1]?.sourceRefs).toEqual([source.id]);
    expect(briefs[2]?.sourceRefs).toEqual([]);
    expect(await listSources("project-1")).toHaveLength(1);
  });

  it("updates only the unit evidence pack and keeps documentary passages honest", async () => {
    const dataDir = makeTempDataDir();
    directories.push(dataDir);
    process.env.AUTO_ESSAY_DATA_DIR = dataDir;
    const kept = createSource({ projectId: "project-1", title: "Gardée", content: "A" });
    const removed = createSource({ projectId: "project-1", title: "Retirée", content: "B" });
    await setSources("project-1", [kept, removed]);
    const unit = await createUnit("project-1", {
      granularity: "paragraph",
      content: "Paragraphe existant",
      evidencePack: {
        sourceIds: [kept.id, removed.id],
        keyCitations: [
          { sourceId: kept.id, quote: "Passage gardé" },
          { sourceId: removed.id, quote: "Passage retiré" },
        ],
        supportingClaimIds: [],
        objections: [{ statement: "Objection retirée", sourceId: removed.id }],
      },
    });
    const section = createManuscriptNode({
      id: "section-1",
      title: "Section",
      children: [createManuscriptLeaf(unit.id, unit.version)],
    });
    const manuscript = createManuscript({ projectId: "project-1", title: "Essai", tree: [section] });
    await putWorkspace("project-1", { manuscript, distribution: [], profiles: [], articulations: [] });
    const app = makeTestApp(dataDir);

    const before = await app.request(`/api/projects/project-1/scope-context/unit/${unit.id}`);
    expect(before.status).toBe(200);
    expect((await before.json()).passages.map((passage: { text: string }) => passage.text)).toEqual([
      "Passage gardé",
      "Passage retiré",
    ]);

    const response = await app.request(
      `/api/projects/project-1/scope-context/unit/${unit.id}/sources/${removed.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ included: false }),
      }
    );
    expect(response.status).toBe(200);
    const context = await response.json();
    expect(context.passages.map((passage: { text: string }) => passage.text)).toEqual(["Passage gardé"]);
    expect(context.sources.find((source: { id: string }) => source.id === removed.id).included).toBe(false);

    const stored = await getUnit("project-1", unit.id);
    expect(stored?.evidencePack.sourceIds).toEqual([kept.id]);
    expect(stored?.evidencePack.objections).toEqual([]);
    expect(stored?.content).toBe("Paragraphe existant");
    expect(await listSources("project-1")).toHaveLength(2);
  });
});
