import { describe, expect, it } from "vitest";
import { getWorkspace } from "../src/services/editorialWorkspaceStore.js";
import { listUnits } from "../src/services/unitStore.js";
import { makeTempDataDir, makeTestApp, postJson } from "./helper.js";

describe("manuscript reimport routes", () => {
  it("keeps a reimport preview transient, then replaces an explicitly selected section after paragraph splitting", async () => {
    const app = makeTestApp(makeTempDataDir());
    const created = await postJson(app, "/api/projects", { title: "Projet à reprendre" });
    const { project } = (await created.json()) as { project: { id: string } };
    const initialPreview = {
      title: "Essai",
      sections: [{ id: "opening", title: "Ouverture", content: "Premier paragraphe.\n\nSecond paragraphe.", level: 1, annotations: [] }],
    };
    const imported = await postJson(app, `/api/projects/${project.id}/manuscript-import/confirm`, { preview: initialPreview });
    const { units: importedUnits } = (await imported.json()) as { units: Array<{ id: string }> };

    const split = await postJson(app, `/api/projects/${project.id}/manuscript/units/${importedUnits[0].id}/split`, {});
    expect(split.status).toBe(200);
    expect(await listUnits(project.id)).toHaveLength(2);

    const previewResponse = await postJson(app, `/api/projects/${project.id}/manuscript-import/reimport-preview`, {
      name: "essai.md",
      content: "# Ouverture\n\nVersion réimportée.",
    });
    expect(previewResponse.status).toBe(200);
    const previewBody = (await previewResponse.json()) as {
      preview: { sections: Array<{ id: string; title: string; content: string }> };
      comparison: { manuscriptUpdatedAt: string; targets: Array<{ id: string; title: string; unitCount: number }> };
    };
    expect(previewBody.comparison.targets).toEqual([{ id: "opening", title: "Ouverture", unitCount: 2 }]);
    expect(await listUnits(project.id)).toHaveLength(2);

    const confirmed = await postJson(app, `/api/projects/${project.id}/manuscript-import/reimport-confirm`, {
      preview: { title: "essai", sections: previewBody.preview.sections.map((section) => ({ ...section, level: 1, annotations: [] })) },
      manuscriptUpdatedAt: previewBody.comparison.manuscriptUpdatedAt,
      actions: [{ sectionId: previewBody.preview.sections[0].id, action: "replace", targetSectionId: "opening" }],
    });
    expect(confirmed.status).toBe(200);
    const units = await listUnits(project.id);
    expect(units).toHaveLength(1);
    expect(units[0]).toMatchObject({ granularity: "section", content: "Version réimportée." });
    await expect(getWorkspace(project.id)).resolves.toMatchObject({
      manuscript: { tree: [{ id: "opening", children: [{ kind: "leaf", unitId: units[0].id, version: 1 }] }] },
    });
  });

  it("refuses incomplete choices without changing the current manuscript", async () => {
    const app = makeTestApp(makeTempDataDir());
    const created = await postJson(app, "/api/projects", { title: "Projet stable" });
    const { project } = (await created.json()) as { project: { id: string } };
    const initialPreview = {
      title: "Essai",
      sections: [{ id: "opening", title: "Ouverture", content: "Texte initial.", level: 1, annotations: [] }],
    };
    await postJson(app, `/api/projects/${project.id}/manuscript-import/confirm`, { preview: initialPreview });
    const before = await listUnits(project.id);
    const previewResponse = await postJson(app, `/api/projects/${project.id}/manuscript-import/reimport-preview`, {
      name: "essai.md",
      content: "# Ouverture\n\nTexte modifié.\n\n# Ajout\n\nTexte ajouté.",
    });
    const previewBody = (await previewResponse.json()) as {
      preview: { title: string; sections: Array<{ id: string; title: string; content: string; level: number; annotations: [] }> };
      comparison: { manuscriptUpdatedAt: string };
    };

    const rejected = await postJson(app, `/api/projects/${project.id}/manuscript-import/reimport-confirm`, {
      preview: previewBody.preview,
      manuscriptUpdatedAt: previewBody.comparison.manuscriptUpdatedAt,
      actions: [{ sectionId: previewBody.preview.sections[0].id, action: "ignore" }],
    });
    expect(rejected.status).toBe(400);
    await expect(rejected.json()).resolves.toMatchObject({ message: "Choisissez une action pour chaque section importée." });
    expect(await listUnits(project.id)).toEqual(before);
  });
});
