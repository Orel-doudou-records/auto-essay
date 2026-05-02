import { describe, it, expect } from "vitest";
import {
  createClaim,
  isClaimPublishable,
  STRONG_ASSERTION_WORDS,
  PRUDENT_WORDS,
} from "../src/domain/claim";

describe("Claim", () => {
  it("should create a claim with defaults", () => {
    const claim = createClaim({
      projectId: "proj-1",
      statement: "Test claim",
      confidenceLevel: "probable",
    });

    expect(claim.id).toBeDefined();
    expect(claim.statement).toBe("Test claim");
    expect(claim.confidenceLevel).toBe("probable");
    expect(claim.status).toBe("pending");
    expect(claim.sourceIds).toEqual([]);
  });

  it("should reject unsupported claims for publishing", () => {
    const unsupported = createClaim({
      projectId: "proj-1",
      statement: "Unverified",
      confidenceLevel: "unsupported",
    });

    expect(isClaimPublishable(unsupported)).toBe(false);

    const verified = createClaim({
      projectId: "proj-1",
      statement: "Verified",
      confidenceLevel: "certain",
    });
    verified.status = "verified";

    expect(isClaimPublishable(verified)).toBe(true);
  });

  it("should have strong assertion words defined", () => {
    expect(STRONG_ASSERTION_WORDS.length).toBeGreaterThan(0);
    expect(STRONG_ASSERTION_WORDS).toContain("d\u00e9montre");
    expect(STRONG_ASSERTION_WORDS).toContain("prouve");
  });

  it("should have prudent words defined", () => {
    expect(PRUDENT_WORDS.length).toBeGreaterThan(0);
    expect(PRUDENT_WORDS).toContain("sugg\u00e8re");
  });
});
