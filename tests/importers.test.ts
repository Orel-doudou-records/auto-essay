import { describe, it, expect } from "vitest";
import {
  parseFrontmatter,
  extractCitations,
} from "../src/ingestion/importers";

describe("parseFrontmatter", () => {
  it("returns empty frontmatter and original body when no frontmatter", () => {
    const content = "# Titre\n\nCorps du texte.";
    const result = parseFrontmatter(content);

    expect(result.frontmatter).toEqual({});
    expect(result.body).toBe(content);
  });

  it("parses YAML multi-line list", () => {
    const content = `---
title: Mon essai
tags:
  - tag1
  - tag2
  - tag3
---
Corps du texte.`;

    const result = parseFrontmatter(content);

    expect(result.frontmatter.title).toBe("Mon essai");
    expect(result.frontmatter.tags).toEqual(["tag1", "tag2", "tag3"]);
    expect(result.body).toBe("Corps du texte.");
  });

  it("parses quoted values containing colons", () => {
    const content = `---
title: "Essai: introduction"
author: 'Nom: Prénom'
---
Corps.`;

    const result = parseFrontmatter(content);

    expect(result.frontmatter.title).toBe("Essai: introduction");
    expect(result.frontmatter.author).toBe("Nom: Prénom");
  });

  it("preserves typed scalar values", () => {
    const content = `---
year: 2024
published: true
score: 9.5
---
Corps.`;

    const result = parseFrontmatter(content);

    expect(result.frontmatter.year).toBe(2024);
    expect(result.frontmatter.published).toBe(true);
    expect(result.frontmatter.score).toBe(9.5);
  });

  it("throws when YAML is syntactically invalid", () => {
    const content = `---
title: "unclosed string
---
Corps.`;

    expect(() => parseFrontmatter(content)).toThrow();
  });

  it("throws when YAML frontmatter is not an object", () => {
    const content = `---
- item1
- item2
---
Corps.`;

    expect(() => parseFrontmatter(content)).toThrow();
  });
});

describe("extractCitations", () => {
  it("joins consecutive blockquote lines into a single citation", () => {
    const content = `> Première ligne de la citation.
> Deuxième ligne de la citation.

Texte normal.`;

    const citations = extractCitations(content);

    expect(citations).toHaveLength(1);
    expect(citations[0].quote).toBe(
      "Première ligne de la citation. Deuxième ligne de la citation."
    );
  });

  it("produces separate citations for blocks separated by a non-citation line", () => {
    const content = `> Première citation.

> Deuxième citation.`;

    const citations = extractCitations(content);

    expect(citations).toHaveLength(2);
    expect(citations[0].quote).toBe("Première citation.");
    expect(citations[1].quote).toBe("Deuxième citation.");
  });

  it("extracts page number from citation", () => {
    const content = `> Citation exacte (p. 12).

Texte.`;

    const citations = extractCitations(content);

    expect(citations).toHaveLength(1);
    expect(citations[0].page).toBe("12");
  });
});
