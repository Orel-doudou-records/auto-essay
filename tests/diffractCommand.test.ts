import { describe, expect, it, vi } from "vitest";
import {
  buildDiffractiveRequest,
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
  });

  describe("runDiffract", () => {
    it("produces a reading via the injected client and formats it", async () => {
      const generateJson = vi.fn(async () => ({
        pass1: { refraction: ["r"] },
        pass2: { namedPatterns: [], revealedDefaults: [] },
        pass3: { entanglements: [] },
        pass4: { cut: "c", included: [], excluded: [], cutOfNonAdoption: [] },
        verdict: "integrate_now",
        action: "a",
      }));

      const reading = await runDiffract({ statement: "s" }, { generateJson });

      expect(reading.fragment.statement).toBe("s");
      expect(reading.verdict).toBe("integrate_now");
      expect(formatReading(reading)).toContain('"verdict": "integrate_now"');
    });
  });
});
