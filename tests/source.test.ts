import { describe, it, expect } from "vitest";
import {
  createSource,
  SourcePositionSchema,
  SourceRegimeSchema,
  SourceTypeSchema,
  VerificationStatusSchema,
} from "../src/domain/source";

describe("Source", () => {
  it("should create a source with backwards-compatible defaults", () => {
    const source = createSource({
      projectId: "proj-1",
      title: "Test Source",
      content: "Test content",
    });

    expect(source.id).toBeDefined();
    expect(source.title).toBe("Test Source");
    expect(source.type).toBe("note");
    expect(source.regime).toBeUndefined();
    expect(source.position).toBeUndefined();
    expect(source.epistemicLimits).toEqual([]);
    expect(source.verificationStatus).toBe("unverified");
    expect(source.annotations).toEqual([]);
    expect(source.tags).toEqual([]);
  });

  it("should distinguish technical type from documentary regime", () => {
    const archive = createSource({
      projectId: "proj-1",
      title: "Institutional archive",
      content: "Archived record",
      type: "pdf",
      regime: "institutional_archive",
      position: {
        role: "institutional_record",
        institutionalAffiliation: "Municipal archive",
      },
      epistemicLimits: ["Does not document oral testimony"],
    });

    const testimony = createSource({
      projectId: "proj-1",
      title: "Interview transcript",
      content: "First-person account",
      type: "pdf",
      regime: "testimony",
      position: {
        role: "primary_witness",
        perspective: "Participant account recorded twenty years later",
      },
    });

    expect(archive.type).toBe("pdf");
    expect(testimony.type).toBe("pdf");
    expect(archive.regime).toBe("institutional_archive");
    expect(testimony.regime).toBe("testimony");
  });

  it("should validate source type", () => {
    expect(() => SourceTypeSchema.parse("invalid")).toThrow();
    expect(SourceTypeSchema.parse("zotero")).toBe("zotero");
    expect(SourceTypeSchema.parse("pdf")).toBe("pdf");
  });

  it("should validate documentary regime", () => {
    expect(SourceRegimeSchema.parse("academic_study")).toBe("academic_study");
    expect(SourceRegimeSchema.parse("personal_memory")).toBe("personal_memory");
    expect(() => SourceRegimeSchema.parse("objective_truth")).toThrow();
  });

  it("should reject an empty situated position", () => {
    expect(() => SourcePositionSchema.parse({})).toThrow();
    expect(
      SourcePositionSchema.parse({
        role: "critic",
        declaredInterests: ["Independent cultural criticism"],
      })
    ).toEqual({
      role: "critic",
      declaredInterests: ["Independent cultural criticism"],
    });
  });

  it("should validate verification status", () => {
    expect(() => VerificationStatusSchema.parse("unknown")).toThrow();
    expect(VerificationStatusSchema.parse("verified")).toBe("verified");
  });
});
