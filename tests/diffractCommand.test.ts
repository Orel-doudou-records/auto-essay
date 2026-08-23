import { describe, expect, it, vi } from "vitest";
import {
  buildDiffractiveRequest,
  extractConcepts,
  extractTensions,
  formatReading,
  parseDiffractArgs,
  runDiffract,
  splitList,
} from "../src/editorial/diffractCommand";

describe("diffractCommand", () => {
  describe("parseDiffractArgs", () => {
    it("parses statement, book, claims and sources", () => {
      const args = parseDiffractArgs([
        "--statement",
        "Le messianisme se technicise.",
        "--book",
        "Extrait du livre.",
        "--claims",
        "claim-1, claim-2",
        "--sources",
        "source-1",
      ]);

      expect(args.statement).toBe("Le messianisme se technicise.");
      expect(args.book).toBe("Extrait du livre.");
      expect(args.claimIds).toEqual(["claim-1", "claim-2"]);
      expect(args.sourceIds).toEqual(["source-1"]);
    });

    it("keeps the book path without reading the file", () => {
      const args = parseDiffractArgs([
        "--statement",
        "s",
        "--book-file",
        "/tmp/livre.txt",
      ]);

      expect(args.bookPath).toBe("/tmp/livre.txt");
      expect(args.book).toBeUndefined();
    });

    it("parses concepts and tensions file paths without reading them", () => {
      const args = parseDiffractArgs([
        "--statement",
        "s",
        "--concepts",
        "/tmp/concepts.json",
        "--tensions",
        "/tmp/tensions.json",
      ]);

      expect(args.conceptsPath).toBe("/tmp/concepts.json");
      expect(args.tensionsPath).toBe("/tmp/tensions.json");
    });

    it("throws without a statement", () => {
      expect(() => parseDiffractArgs(["--book", "x"])).toThrow();
      expect(() => parseDiffractArgs(["--statement", "   "])).toThrow();
    });
  });

  describe("splitList", () => {
    it("splits on commas and trims", () => {
      expect(splitList("a, b ,c")).toEqual(["a", "b", "c"]);
    });

    it("returns an empty list for empty input", () => {
      expect(splitList(undefined)).toEqual([]);
      expect(splitList("")).toEqual([]);
      expect(splitList(" , ")).toEqual([]);
    });
  });

  describe("extractConcepts", () => {
    it("keeps only label and definition", () => {
      expect(
        extractConcepts([
          {
            id: "concept-exil",
            label: "exil",
            definition: "Condition diasporique.",
            scope: { level: "project" },
            status: "proposed",
          },
          { label: "sans definition" },
          "not-an-object",
        ])
      ).toEqual([
        { label: "exil", definition: "Condition diasporique." },
        { label: "sans definition", definition: "" },
      ]);
    });

    it("returns an empty list for non-arrays", () => {
      expect(extractConcepts(undefined)).toEqual([]);
      expect(extractConcepts("x")).toEqual([]);
    });
  });

  describe("extractTensions", () => {
    it("keeps only label and description", () => {
      expect(
        extractTensions([
          {
            id: "tension-technique-memoire",
            label: "technique contre mémoire",
            description: "L'avenir technologique contre la mémoire.",
            poles: ["technique", "mémoire"],
          },
        ])
      ).toEqual([
        {
          label: "technique contre mémoire",
          description: "L'avenir technologique contre la mémoire.",
        },
      ]);
    });

    it("returns an empty list for non-arrays", () => {
      expect(extractTensions(null)).toEqual([]);
    });
  });

  describe("buildDiffractiveRequest", () => {
    it("maps args to a request", () => {
      const request = buildDiffractiveRequest({
        statement: "s",
        claimIds: ["c1"],
        sourceIds: ["s1"],
        book: "b",
      });

      expect(request).toEqual({
        statement: "s",
        claimIds: ["c1"],
        sourceIds: ["s1"],
        book: "b",
      });
    });

    it("forwards concepts and tensions when present", () => {
      const request = buildDiffractiveRequest({
        statement: "s",
        claimIds: [],
        sourceIds: [],
        concepts: [{ label: "exil", definition: "d" }],
        tensions: [{ label: "t", description: "desc" }],
      });

      expect(request.concepts).toEqual([{ label: "exil", definition: "d" }]);
      expect(request.tensions).toEqual([{ label: "t", description: "desc" }]);
    });

    it("omits empty concepts and tensions", () => {
      const request = buildDiffractiveRequest({
        statement: "s",
        claimIds: [],
        sourceIds: [],
        concepts: [],
        tensions: [],
      });

      expect(request.concepts).toBeUndefined();
      expect(request.tensions).toBeUndefined();
    });
  });

  describe("runDiffract", () => {
    it("produces a reading via the injected client and formats it", async () => {
      const generateJson = vi.fn(async () => ({
        pass1: { refraction: ["r"] },
        pass2: { namedPatterns: [], revealedDefaults: [] },
        pass3: { entanglements: [] },
        pass4: { cut: "c", included: [], excluded: [], cutOfNonAdoption: [] },
        verdict: "integrate_now",
        verdictDetail: "Intègre maintenant.",
        action: "a",
      }));

      const reading = await runDiffract({ statement: "s" }, { generateJson });

      expect(reading.fragment.statement).toBe("s");
      expect(reading.verdict).toBe("integrate_now");
      expect(formatReading(reading)).toContain('"verdict": "integrate_now"');
    });
  });
});
