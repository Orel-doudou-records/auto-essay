import { describe, expect, it } from "vitest";
import {
  applyManuscriptReimport,
  compareManuscriptReimport,
  createDraftUnit,
  createManuscript,
  createManuscriptLeaf,
  createManuscriptNode,
  type ManuscriptImportPreview,
} from "../src/index";

describe("manuscript reimport", () => {
  it("replaces an explicitly chosen section after it was split into paragraphs", () => {
    const first = createDraftUnit({ projectId: "project-1", granularity: "paragraph", content: "Premier paragraphe.", contextInPlan: { section: "opening" } });
    const second = createDraftUnit({ projectId: "project-1", granularity: "paragraph", content: "Second paragraphe.", contextInPlan: { section: "opening" } });
    const manuscript = createManuscript({
      projectId: "project-1",
      title: "Essai",
      tree: [createManuscriptNode({ id: "opening", title: "Ouverture", children: [createManuscriptLeaf(first.id, first.version), createManuscriptLeaf(second.id, second.version)] })],
    });
    const preview = incomingPreview([{ id: "new-opening", title: "Ouverture", content: "Version reprise.", level: 1 }]);

    expect(compareManuscriptReimport(manuscript, preview)).toMatchObject({
      targets: [{ id: "opening", title: "Ouverture", unitCount: 2 }],
      suggestions: [{ sectionId: "new-opening", action: "replace", targetSectionId: "opening" }],
    });

    const result = applyManuscriptReimport(manuscript, [first, second], preview, [
      { sectionId: "new-opening", action: "replace", targetSectionId: "opening" },
    ]);

    expect(result.units).toHaveLength(1);
    expect(result.units[0]).toMatchObject({ granularity: "section", thesis: "Ouverture", content: "Version reprise." });
    expect(result.replacedUnitIds).toEqual([first.id, second.id]);
    expect(result.manuscript.tree).toMatchObject([
      { id: "opening", children: [{ kind: "leaf", unitId: result.units[0].id, version: 1 }] },
    ]);
  });

  it("rejects an incomplete choice before changing any value", () => {
    const unit = createDraftUnit({ projectId: "project-1", granularity: "section", content: "Texte.", contextInPlan: { section: "opening" } });
    const manuscript = createManuscript({
      projectId: "project-1",
      title: "Essai",
      tree: [createManuscriptNode({ id: "opening", title: "Ouverture", children: [createManuscriptLeaf(unit.id, unit.version)] })],
    });
    const preview = incomingPreview([
      { id: "incoming-1", title: "Ouverture", content: "Texte nouveau.", level: 1 },
      { id: "incoming-2", title: "Ajout", content: "Texte ajouté.", level: 1 },
    ]);

    expect(() => applyManuscriptReimport(manuscript, [unit], preview, [
      { sectionId: "incoming-1", action: "ignore" },
    ])).toThrow("Choisissez une action pour chaque section importée.");
    expect(manuscript.tree[0]).toMatchObject({ id: "opening", children: [{ unitId: unit.id }] });
  });
});

function incomingPreview(sections: Array<{ id: string; title: string; content: string; level: number }>): ManuscriptImportPreview {
  return { title: "Essai importé", sections: sections.map((section) => ({ ...section, annotations: [] })) };
}
