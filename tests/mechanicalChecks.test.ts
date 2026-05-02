import { describe, it, expect } from "vitest";
import {
  detectStrongAssertions,
  detectMissingCitations,
  detectFillerPhrases,
  detectTransitionOveruse,
  detectUnclearBoundaries,
  runMechanicalChecks,
  passesMechanicalChecks,
  checkCitationFormat,
} from "../src/evaluation/mechanicalChecks";

describe("Mechanical Checks", () => {
  describe("detectStrongAssertions", () => {
    it("should detect strong assertions without citations", () => {
      const text = "Cette \u00e9tude d\u00e9montre que le changement climatique est r\u00e9el.";
      const issues = detectStrongAssertions(text);

      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].type).toBe("strong_assertion");
      expect(issues[0].severity).toBe("warning");
    });

    it("should not flag strong assertions with citations", () => {
      const text = "Cette \u00e9tude d\u00e9montre que le changement climatique est r\u00e9el (Smith, 2023).";
      const issues = detectStrongAssertions(text);

      expect(issues.length).toBe(0);
    });
  });

  describe("detectFillerPhrases", () => {
    it("should detect filler phrases", () => {
      const text = "Il est important de noter que cette decouverte change tout.";
      const issues = detectFillerPhrases(text);

      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].type).toBe("filler_phrase");
    });
  });

  describe("detectTransitionOveruse", () => {
    it("should detect overused transitions", () => {
      const text = "Cependant, ceci est vrai. Cependant, cela aussi. Cependant, finalement.".repeat(10);
      const issues = detectTransitionOveruse(text);

      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].type).toBe("transition_overuse");
    });
  });

  describe("detectUnclearBoundaries", () => {
    it("should detect unclear fact/interpretation boundaries", () => {
      const text = "Les donnees montrent une correlation, ce qui prouve que la cause est unique.";
      const issues = detectUnclearBoundaries(text);

      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].type).toBe("unclear_boundary");
    });
  });

  describe("checkCitationFormat", () => {
    it("should detect malformed citations", () => {
      const text = "Selon Smith 2023 (pas de virgule) et aussi (p.) sans numero.";
      const issues = checkCitationFormat(text);

      expect(issues.length).toBeGreaterThan(0);
    });
  });

  describe("runMechanicalChecks", () => {
    it("should run all checks and return sorted issues", () => {
      const text = `Il est important de noter que cette etude demontre la verite.
      Cependant, ceci est vrai. Cependant, cela aussi.`;
      
      const issues = runMechanicalChecks(text);

      expect(issues.length).toBeGreaterThan(0);
      // Should be sorted by severity (error < warning < info)
      const severityOrder = { error: 0, warning: 1, info: 2 };
      const severities = issues.map((i) => i.severity);
      const expected = [...severities].sort(
        (a, b) => severityOrder[a] - severityOrder[b]
      );
      expect(severities).toEqual(expected);
    });
  });

  describe("passesMechanicalChecks", () => {
    it("should pass for clean text", () => {
      const text = "Ceci est un texte simple sans problemes.";
      const result = passesMechanicalChecks(text);

      expect(result.passed).toBe(true);
      expect(result.issues.length).toBe(0);
    });

    it("should fail for text with too many warnings", () => {
      const text = "Cette etude demontre cela. Celle-ci prouve ceci. Cela confirme tout. Cette etude demontre cela. Celle-ci prouve ceci. Cela confirme tout.";
      const result = passesMechanicalChecks(text, 0, 2);

      expect(result.passed).toBe(false);
    });
  });
});
