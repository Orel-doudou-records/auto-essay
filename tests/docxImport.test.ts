import { describe, expect, it } from "vitest";
import { previewDocxHtml } from "../src/ingestion/docxImport";

describe("previewDocxHtml", () => {
  it("normalises headings, paragraphs, links and comments into the manuscript preview", () => {
    const preview = previewDocxHtml(
      "essai.docx",
      '<p>Avant-propos.</p><h1>Ouverture</h1><p>Texte avec <a href="https://example.test/repere">un repère</a><sup><a href="#auto-essay-docx-comment-0" id="auto-essay-docx-comment-ref-0">[OA1]</a></sup>.</p><h2>Suite</h2><p>Le second passage.</p><dl><dt id="auto-essay-docx-comment-0">Comment [OA1]</dt><dd><p>À vérifier <strong>avec soin</strong>. <a href="#auto-essay-docx-comment-ref-0">↑</a></p></dd></dl>'
    );

    expect(preview).toMatchObject({
      title: "essai",
      sections: [
        { title: "Section provisoire", level: 1, content: "Avant-propos." },
        {
          title: "Ouverture",
          level: 1,
          content: "Texte avec un repère.",
          annotations: [
            { kind: "link", label: "un repère", url: "https://example.test/repere" },
            { kind: "comment", content: "À vérifier avec soin." },
          ],
        },
        { title: "Suite", level: 2, content: "Le second passage." },
      ],
    });
  });

  it("keeps unsupported links and HTML-like text as inert editable text", () => {
    const preview = previewDocxHtml(
      "inert.docx",
      '<h1>Ouverture</h1><p><a href="javascript:alert(1)">Lien</a> &lt;script&gt;inert&lt;/script&gt;</p>'
    );

    expect(preview.sections[0]).toMatchObject({
      content: "Lien <script>inert</script>",
      annotations: [],
    });
  });

  it("keeps a normal list that contains a footnote reference", () => {
    const preview = previewDocxHtml(
      "notes.docx",
      '<h1>Liste</h1><ol><li>Premier point<sup><a href="#auto-essay-docx-footnote-1" id="auto-essay-docx-footnote-ref-1">[1]</a></sup></li><li>Second point</li></ol><ol><li id="auto-essay-docx-footnote-1"><p>Note de bas de page. <a href="#auto-essay-docx-footnote-ref-1">↑</a></p></li></ol>'
    );

    expect(preview.sections[0]).toMatchObject({
      content: "Premier point\n\nSecond point",
      annotations: [{ kind: "comment", content: "Note de bas de page." }],
    });
  });

  it("rejects an empty conversion", () => {
    expect(() => previewDocxHtml("vide.docx", "<p></p>")).toThrow(
      "Le document Word ne contient aucun titre ni paragraphe à importer."
    );
  });
});
