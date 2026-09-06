import { describe, expect, it } from "vitest";
import { getWorkspace } from "../src/services/editorialWorkspaceStore.js";
import { listUnits } from "../src/services/unitStore.js";
import { makeTempDataDir, makeTestApp, postJson } from "./helper.js";

describe("manuscript granularity routes", () => {
  it("splits an imported section, then merges adjacent paragraphs without losing manuscript order", async () => {
    const { app, projectId, unitId } = await importSection("Premier paragraphe.\n\nDeuxième paragraphe.\n\nTroisième paragraphe.");

    const split = await postJson(app, `/api/projects/${projectId}/manuscript/units/${unitId}/split`, {});
    expect(split.status).toBe(200);
    const splitBody = (await split.json()) as { units: Array<{ id: string; content: string; granularity: string }>; unitIds: string[] };
    expect(splitBody.units).toMatchObject([
      { content: "Premier paragraphe.", granularity: "paragraph" },
      { content: "Deuxième paragraphe.", granularity: "paragraph" },
      { content: "Troisième paragraphe.", granularity: "paragraph" },
    ]);

    const splitWorkspace = await getWorkspace(projectId);
    expect(splitWorkspace.manuscript.tree[0]).toMatchObject({
      children: splitBody.unitIds.map((id) => ({ kind: "leaf", unitId: id, version: 1 })),
    });

    const merged = await postJson(
      app,
      `/api/projects/${projectId}/manuscript/units/${splitBody.unitIds[0]}/merge-next`,
      {}
    );
    expect(merged.status).toBe(200);
    await expect(merged.json()).resolves.toMatchObject({
      units: [
        { content: "Premier paragraphe.\n\nDeuxième paragraphe.", granularity: "section" },
        { content: "Troisième paragraphe.", granularity: "paragraph" },
      ],
      unitIds: [expect.any(String)],
    });

    const mergedWorkspace = await getWorkspace(projectId);
    expect(mergedWorkspace.manuscript.tree[0]).toMatchObject({
      children: [
        { kind: "leaf", version: 1 },
        { kind: "leaf", unitId: splitBody.unitIds[2], version: 1 },
      ],
    });
    expect(await listUnits(projectId)).toHaveLength(2);
  });

  it("explains why a section cannot be split and preserves the manuscript", async () => {
    const { app, projectId, unitId } = await importSection("Un seul paragraphe.");

    const rejected = await postJson(app, `/api/projects/${projectId}/manuscript/units/${unitId}/split`, {});
    expect(rejected.status).toBe(400);
    await expect(rejected.json()).resolves.toMatchObject({
      message: "Cette unité ne contient pas plusieurs paragraphes à scinder.",
    });
    await expect(listUnits(projectId)).resolves.toMatchObject([{ id: unitId, content: "Un seul paragraphe." }]);
    await expect(getWorkspace(projectId)).resolves.toMatchObject({
      manuscript: { tree: [{ children: [{ kind: "leaf", unitId, version: 1 }] }] },
    });
  });
});

async function importSection(content: string) {
  const app = makeTestApp(makeTempDataDir());
  const created = await postJson(app, "/api/projects", { title: "Projet granulaire" });
  const { project } = (await created.json()) as { project: { id: string } };
  const confirmation = await postJson(app, `/api/projects/${project.id}/manuscript-import/confirm`, {
    preview: {
      title: "Essai granulaire",
      sections: [{ id: "section-importee", title: "Ouverture", content, level: 1, annotations: [] }],
    },
  });
  expect(confirmation.status).toBe(201);
  const body = (await confirmation.json()) as { units: Array<{ id: string }> };
  return { app, projectId: project.id, unitId: body.units[0].id };
}
