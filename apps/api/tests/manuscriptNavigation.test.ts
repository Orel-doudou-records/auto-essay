import { createDraftUnit } from "@auto-essay/core";
import { describe, expect, it } from "vitest";
import { setUnits } from "../src/services/unitStore.js";
import { makeTempDataDir, makeTestApp, postJson } from "./helper";

describe("manuscript navigation", () => {
  it("projects the manuscript tree with resolved sections and paragraphs", async () => {
    const app = makeTestApp(makeTempDataDir());
    const created = await postJson(app, "/api/projects", { title: "Essai" });
    const { project } = await created.json() as { project: { id: string } };
    const unit = { ...createDraftUnit({ projectId: project.id, granularity: "paragraph", content: "Texte." }), id: "paragraph-1" };
    const addedUnit = { ...createDraftUnit({ projectId: project.id, granularity: "section", content: "Autre texte." }), id: "section-2" };
    await setUnits(project.id, [unit, addedUnit]);
    await app.request(`/api/projects/${project.id}/editorial/workspace`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        manuscript: { id: "manuscript-1", projectId: project.id, title: "Essai", createdAt: "2026-09-07T00:00:00.000Z", updatedAt: "2026-09-07T00:00:00.000Z", tree: [{ kind: "node", id: "chapter-1", title: "Chapitre 1", children: [{ kind: "node", id: "section-1", title: "Section 1", children: [{ kind: "leaf", unitId: unit.id, version: unit.version }] }] }] },
        distribution: [], profiles: [], articulations: [],
      }),
    });

    const response = await app.request(`/api/projects/${project.id}/editorial/manuscript-navigation`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      entries: [
        { kind: "node", id: "chapter-1", title: "Chapitre 1", children: [{ kind: "node", id: "section-1", title: "Section 1", children: [{ kind: "leaf", unitId: unit.id, version: unit.version, status: "drafting", granularity: "paragraph" }] }] },
        { kind: "leaf", unitId: addedUnit.id, version: addedUnit.version, status: "drafting", granularity: "section" },
      ],
    });
  });
});
