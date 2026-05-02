import { describe, it, expect } from "vitest";
import {
  createSource,
  SourceTypeSchema,
  VerificationStatusSchema,
} from "../src/domain/source";

describe("Source", () => {
  it("should create a source with defaults", () => {
    const source = createSource({
      projectId: "proj-1",
      title: "Test Source",
      content: "Test content",
    });

    expect(source.id).toBeDefined();
    expect(source.title).toBe("Test Source");
    expect(source.type).toBe("note");
    expect(source.verificationStatus).toBe("unverified");
    expect(source.annotations).toEqual([]);
    expect(source.tags).toEqual([]);
  });

  it("should validate source type", () => {
    expect(() => SourceTypeSchema.parse("invalid")).toThrow();
    expect(SourceTypeSchema.parse("zotero")).toBe("zotero");
    expect(SourceTypeSchema.parse("pdf")).toBe("pdf");
  });

  it("should validate verification status", () => {
    expect(() => VerificationStatusSchema.parse("unknown")).toThrow();
    expect(VerificationStatusSchema.parse("verified")).toBe("verified");
  });
});
