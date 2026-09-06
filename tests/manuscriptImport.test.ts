import { describe, expect, it } from "vitest";
import { previewMarkdownManuscript } from "../src/ingestion/manuscriptImport";

describe("Markdown manuscript import preview", () => {
  it("turns headings into editable sections and keeps links and comments as annotations", () => {
    const preview = previewMarkdownManuscript("essai.md", `---
title: Essai importé
---

# Titre de travail

## Première partie

Un [lien utile](https://example.test) pour le lecteur.
<!-- Revoir cette transition -->

### Détour

Un second passage.`);

    expect(preview.title).toBe("Essai importé");
    expect(preview.sections).toEqual([
      expect.objectContaining({
        title: "Titre de travail",
        level: 1,
        content: "",
      }),
      expect.objectContaining({
        title: "Première partie",
        level: 2,
        content: "Un [lien utile](https://example.test) pour le lecteur.",
        annotations: [
          { kind: "link", label: "lien utile", url: "https://example.test" },
          { kind: "comment", content: "Revoir cette transition" },
        ],
      }),
      expect.objectContaining({
        title: "Détour",
        level: 3,
        content: "Un second passage.",
      }),
    ]);
  });

  it("creates one provisional section when no heading can be recognized", () => {
    const preview = previewMarkdownManuscript("texte-en-cours.md", "Un texte sans titre fiable.");

    expect(preview.title).toBe("texte-en-cours");
    expect(preview.sections).toEqual([
      expect.objectContaining({
        title: "Section provisoire",
        level: 1,
        content: "Un texte sans titre fiable.",
      }),
    ]);
  });

  it("preserves text that appears before the first heading", () => {
    const preview = previewMarkdownManuscript("texte.md", "Un préambule.\n\n# Première partie\n\nLa suite.");

    expect(preview.sections).toEqual([
      expect.objectContaining({ title: "Section provisoire", content: "Un préambule." }),
      expect.objectContaining({ title: "Première partie", content: "La suite." }),
    ]);
  });

  it("does not reinterpret Markdown inside a code block and normalizes Windows frontmatter", () => {
    const preview = previewMarkdownManuscript(
      "texte.md",
      "---\r\ntitle: Avec Windows\r\n---\r\n\r\n# Exemple\r\n\r\n```md\r\n[x](https://example.test)\r\n```"
    );

    expect(preview).toMatchObject({
      title: "Avec Windows",
      sections: [
        {
          title: "Exemple",
          content: "```md\n[x](https://example.test)\n```",
          annotations: [],
        },
      ],
    });
  });

  it("rejects invalid frontmatter instead of silently importing it as prose", () => {
    expect(() => previewMarkdownManuscript("texte.md", "---\ntitle: [\n---\n\nTexte.")).toThrow(
      "Le frontmatter Markdown est invalide."
    );
  });
});
