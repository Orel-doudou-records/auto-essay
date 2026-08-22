import { describe, expect, it } from "vitest";
import { importBibTeX, parseBibTeX } from "../src/ingestion/importers";

describe("parseBibTeX", () => {
  it("parses brace-wrapped fields", () => {
    const entries = parseBibTeX(`@book{benjamin1940,
  author = {Benjamin, Walter},
  title = {Sur le concept d'histoire},
  year = {1940}
}`);

    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe("book");
    expect(entries[0].key).toBe("benjamin1940");
    expect(entries[0].fields.title).toBe("Sur le concept d'histoire");
    expect(entries[0].fields.author).toBe("Benjamin, Walter");
    expect(entries[0].fields.year).toBe("1940");
  });

  it("parses multiple entries", () => {
    const entries = parseBibTeX(
      `@article{a, title = {A}, year = {2020}}\n@book{b, title = {B}}`
    );

    expect(entries).toHaveLength(2);
    expect(entries[1].fields.title).toBe("B");
  });

  it("handles quoted and bare values", () => {
    const entries = parseBibTeX(`@article{x, title = "Quoted", year = 2021}`);

    expect(entries[0].fields.title).toBe("Quoted");
    expect(entries[0].fields.year).toBe("2021");
  });

  it("keeps nested braces stripped from values", () => {
    const entries = parseBibTeX(`@book{k, title = {Sur le {concept}}}`);

    expect(entries[0].fields.title).toBe("Sur le concept");
  });
});

describe("importBibTeX", () => {
  it("converts entries to sources with authors and metadata", () => {
    const result = importBibTeX(
      `@article{a, author = {Doe, Jane and Roe, John}, title = {Test}, year = {2020}, doi = {10.0/x}}`,
      "project-1"
    );

    expect(result.errors).toHaveLength(0);
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].authors).toEqual(["Doe, Jane", "Roe, John"]);
    expect(result.sources[0].title).toBe("Test");
    expect(result.sources[0].doi).toBe("10.0/x");
    expect(result.sources[0].publicationDate).toBe("2020");
  });
});
