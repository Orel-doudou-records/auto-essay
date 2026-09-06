import { describe, expect, it } from "vitest";
import { previewOdtDocument } from "../src/ingestion/odtImport";

describe("previewOdtDocument", () => {
  it("normalises headings, paragraphs, links, notes and comments into the manuscript preview", () => {
    const result = previewOdtDocument(
      "essai.odt",
      '<office:document-content><office:body><office:text><text:p>Avant-propos.</text:p><text:h text:outline-level="1">Ouverture</text:h><text:p>Texte avec <text:a xlink:href="https://example.test/repere">un repère</text:a><text:note text:id="ftn1"><text:note-citation>1</text:note-citation><text:note-body><text:p>À vérifier avec soin.</text:p></text:note-body></text:note>.</text:p><text:h text:outline-level="2">Suite</text:h><text:p>Le second passage.<office:annotation><dc:creator>Auteur</dc:creator><text:p>Commentaire à relire.</text:p></office:annotation></text:p><draw:image xlink:href="Pictures/image.png"/></office:text></office:body></office:document-content>'
    );

    expect(result).toMatchObject({
      preview: {
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
          {
            title: "Suite",
            level: 2,
            content: "Le second passage.",
            annotations: [{ kind: "comment", content: "Commentaire à relire." }],
          },
        ],
      },
      warnings: ["1 image a été ignorée."],
    });
  });

  it("keeps XML-like text and unsupported links inert", () => {
    const result = previewOdtDocument(
      "inert.odt",
      '<office:document-content><office:body><office:text><text:h>Ouverture</text:h><text:p><text:a xlink:href="javascript:alert(1)">Lien</text:a> &lt;script&gt;inert&lt;/script&gt;</text:p></office:text></office:body></office:document-content>'
    );

    expect(result.preview.sections[0]).toMatchObject({ content: "Lien <script>inert</script>", annotations: [] });
  });

  it("reads valid ODT namespaces even when their prefixes differ", () => {
    const result = previewOdtDocument(
      "prefixes.odt",
      '<o:document-content xmlns:o="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:t="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:xl="http://www.w3.org/1999/xlink"><o:body><o:text><t:h t:outline-level="2">Ouverture</t:h><t:p><t:a xl:href="https://example.test">Un lien</t:a><t:note><t:note-body><t:p>Une note.</t:p></t:note-body></t:note></t:p></o:text></o:body></o:document-content>'
    );

    expect(result.preview.sections[0]).toMatchObject({
      title: "Ouverture",
      level: 2,
      content: "Un lien",
      annotations: [
        { kind: "link", label: "Un lien", url: "https://example.test" },
        { kind: "comment", content: "Une note." },
      ],
    });
  });

  it("reads a default text namespace", () => {
    const result = previewOdtDocument(
      "default-namespace.odt",
      '<office:document-content><office:body><office:text xmlns="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:t="urn:oasis:names:tc:opendocument:xmlns:text:1.0"><h t:outline-level="3">Ouverture</h><p>Un paragraphe.</p></office:text></office:body></office:document-content>'
    );

    expect(result.preview.sections[0]).toMatchObject({ title: "Ouverture", level: 3, content: "Un paragraphe." });
  });

  it("rejects a document without editable text", () => {
    expect(() => previewOdtDocument("vide.odt", "<office:document-content/>" )).toThrow(
      "Le document LibreOffice ne contient aucun titre ni paragraphe à importer."
    );
  });
});
