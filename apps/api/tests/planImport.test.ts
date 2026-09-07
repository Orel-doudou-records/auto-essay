import { describe, expect, it } from "vitest";
import { getWorkspace } from "../src/services/editorialWorkspaceStore.js";
import { listUnits } from "../src/services/unitStore.js";
import { makeTempDataDir, makeTestApp, postJson } from "./helper.js";

describe("plan import routes", () => {
  it("keeps a Markdown preview transient, then creates only planned manuscript structure", async () => {
    const app = makeTestApp(makeTempDataDir());
    const created = await postJson(app, "/api/projects", { title: "Projet planifié" });
    const { project } = (await created.json()) as { project: { id: string } };

    const previewResponse = await postJson(app, `/api/projects/${project.id}/manuscript-import/plan-preview`, {
      name: "plan.md",
      content: "# Première partie\n\n## Ouverture\n\nPoser la question centrale.",
    });
    expect(previewResponse.status).toBe(200);
    const { preview } = (await previewResponse.json()) as {
      preview: { title: string; sections: Array<{ title: string; content: string; level: number }> };
    };
    expect(preview).toMatchObject({
      title: "plan",
      sections: [
        { title: "Première partie", content: "", level: 1 },
        { title: "Ouverture", content: "Poser la question centrale.", level: 2 },
      ],
    });
    expect(await listUnits(project.id)).toEqual([]);
    await expect(getWorkspace(project.id)).rejects.toMatchObject({ status: 404 });

    preview.sections[1].title = "Ouverture corrigée";
    const confirmed = await postJson(app, `/api/projects/${project.id}/manuscript-import/plan-confirm`, { preview });
    expect(confirmed.status).toBe(201);
    await expect(confirmed.json()).resolves.toMatchObject({
      manuscript: { projectId: project.id, title: "plan" },
      units: [],
    });
    expect(await listUnits(project.id)).toEqual([]);
    const workspace = await getWorkspace(project.id);
    expect(workspace.manuscript.tree).toMatchObject([
      {
        title: "Première partie",
        children: [{
          title: "Ouverture corrigée",
          plan: [{ subject: "Poser la question centrale." }],
          children: [],
        }],
      },
    ]);
  });

  it("leaves the project unchanged when confirmation is invalid or canceled", async () => {
    const app = makeTestApp(makeTempDataDir());
    const created = await postJson(app, "/api/projects", { title: "Projet vide" });
    const { project } = (await created.json()) as { project: { id: string } };

    const rejected = await postJson(app, `/api/projects/${project.id}/manuscript-import/plan-confirm`, {
      preview: { title: "", sections: [] },
    });
    expect(rejected.status).toBe(400);
    expect(await listUnits(project.id)).toEqual([]);
    await expect(getWorkspace(project.id)).rejects.toMatchObject({ status: 404 });
  });
});
