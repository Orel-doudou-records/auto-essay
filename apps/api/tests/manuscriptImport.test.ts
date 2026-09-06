import { describe, expect, it } from "vitest";
import { getWorkspace } from "../src/services/editorialWorkspaceStore.js";
import { listUnits } from "../src/services/unitStore.js";
import { makeTempDataDir, makeTestApp, postJson } from "./helper.js";

describe("manuscript import routes", () => {
  it("keeps a Markdown preview transient, then creates one section unit and a manuscript on confirmation", async () => {
    const app = makeTestApp(makeTempDataDir());
    const created = await postJson(app, "/api/projects", { title: "Projet importé" });
    const { project } = (await created.json()) as { project: { id: string } };

    const previewResponse = await postJson(app, `/api/projects/${project.id}/manuscript-import/preview`, {
      name: "essai.md",
      content: "# Ouverture\n\nLe premier passage.\n\n## Seconde partie\n\nLe second passage avec un [repère](https://example.test).",
    });
    expect(previewResponse.status).toBe(200);
    const previewBody = (await previewResponse.json()) as {
      preview: { title: string; sections: Array<{ title: string; content: string; level: number }> };
    };
    expect(previewBody.preview).toMatchObject({
      title: "essai",
      sections: [
        { title: "Ouverture", content: "Le premier passage.", level: 1 },
        { title: "Seconde partie", content: "Le second passage avec un [repère](https://example.test).", level: 2 },
      ],
    });
    expect(await listUnits(project.id)).toEqual([]);
    await expect(getWorkspace(project.id)).rejects.toMatchObject({ status: 404 });

    previewBody.preview.sections[1].title = "Partie corrigée";
    const confirmed = await postJson(app, `/api/projects/${project.id}/manuscript-import/confirm`, {
      preview: previewBody.preview,
    });
    expect(confirmed.status).toBe(201);
    await expect(confirmed.json()).resolves.toMatchObject({
      manuscript: { projectId: project.id, title: "essai" },
      units: [
        { thesis: "Ouverture", granularity: "section", content: "Le premier passage." },
        { thesis: "Partie corrigée", granularity: "section", content: "Le second passage avec un [repère](https://example.test)." },
      ],
    });

    const workspace = await getWorkspace(project.id);
    expect(workspace.manuscript.tree).toMatchObject([
      {
        title: "Ouverture",
        children: [
          { kind: "leaf" },
          {
            title: "Partie corrigée",
            notes: [{ text: "Import — lien : repère (https://example.test)" }],
            children: [{ kind: "leaf" }],
          },
        ],
      },
    ]);
  });

  it("refuses confirmation when the project already contains writing", async () => {
    const app = makeTestApp(makeTempDataDir());
    const created = await postJson(app, "/api/projects", { title: "Projet déjà écrit" });
    const { project } = (await created.json()) as { project: { id: string } };
    await postJson(app, `/api/projects/${project.id}/units`, { section: "Déjà là" });

    const rejected = await postJson(app, `/api/projects/${project.id}/manuscript-import/confirm`, {
      preview: {
        title: "Nouveau manuscrit",
        sections: [
          { id: "section-importee", title: "Ouverture", content: "Texte.", level: 1, annotations: [] },
        ],
      },
    });

    expect(rejected.status).toBe(409);
    await expect(rejected.json()).resolves.toMatchObject({ message: "Le projet contient déjà un manuscrit ou des unités." });
  });

  it("reports an empty file and an unsupported format before creating a preview", async () => {
    const app = makeTestApp(makeTempDataDir());
    const created = await postJson(app, "/api/projects", { title: "Projet vide" });
    const { project } = (await created.json()) as { project: { id: string } };

    const empty = await postJson(app, `/api/projects/${project.id}/manuscript-import/preview`, {
      name: "vide.md",
      content: " \n ",
    });
    expect(empty.status).toBe(400);
    await expect(empty.json()).resolves.toMatchObject({ message: "Le manuscrit est vide." });

    const unsupported = await postJson(app, `/api/projects/${project.id}/manuscript-import/preview`, {
      name: "texte.txt",
      content: "Du texte.",
    });
    expect(unsupported.status).toBe(400);
    await expect(unsupported.json()).resolves.toMatchObject({
      message: "Seuls les fichiers Markdown (.md) sont pris en charge pour le moment.",
    });
  });

  it("returns a concise correction when the author empties a title in the preview", async () => {
    const app = makeTestApp(makeTempDataDir());
    const created = await postJson(app, "/api/projects", { title: "Projet à corriger" });
    const { project } = (await created.json()) as { project: { id: string } };

    const invalid = await postJson(app, `/api/projects/${project.id}/manuscript-import/confirm`, {
      preview: {
        title: "",
        sections: [
          { id: "section-importee", title: "", content: "Texte.", level: 1, annotations: [] },
        ],
      },
    });

    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toMatchObject({
      message: "L’aperçu doit contenir un titre de manuscrit et un titre pour chaque section, sans dépasser 5 Mo.",
    });
  });
});
