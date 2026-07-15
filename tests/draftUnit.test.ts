import { describe, it, expect } from "vitest";
import {
  createDraftUnit,
  countWords,
  meetsWordCountTarget,
  GranularitySchema,
} from "../src/domain/draftUnit";

describe("DraftUnit", () => {
  it("should create a paragraph unit with default word count", () => {
    const unit = createDraftUnit({
      projectId: "proj-1",
      granularity: "paragraph",
    });

    expect(unit.id).toBeDefined();
    expect(unit.granularity).toBe("paragraph");
    expect(unit.targetWordCount).toBe(200);
    expect(unit.status).toBe("drafting");
    expect(unit.version).toBe(1);
  });

  it("should keep editorial references optional in historical mode", () => {
    const unit = createDraftUnit({
      projectId: "proj-1",
      granularity: "paragraph",
    });

    expect(unit.editorialPlanId).toBeUndefined();
    expect(unit.appliedDecisionIds).toEqual([]);
    expect(unit.appliedArticulationIds).toEqual([]);
    expect(unit.transformationTraceIds).toEqual([]);
  });

  it("should reference an editorial plan without embedding it", () => {
    const unit = createDraftUnit({
      projectId: "proj-1",
      granularity: "paragraph",
      editorialPlanId: "plan-1",
      appliedDecisionIds: ["decision-1"],
      appliedArticulationIds: ["articulation-1"],
      transformationTraceIds: ["trace-1"],
    });

    expect(unit.editorialPlanId).toBe("plan-1");
    expect(unit.appliedDecisionIds).toEqual(["decision-1"]);
  });

  it("should create a section unit with default word count", () => {
    const unit = createDraftUnit({
      projectId: "proj-1",
      granularity: "section",
    });

    expect(unit.targetWordCount).toBe(1200);
  });

  it("should count words correctly", () => {
    expect(countWords("Hello world")).toBe(2);
    expect(countWords("  Multiple   spaces  ")).toBe(2);
    expect(countWords("")).toBe(0);
  });

  it("should check word count target with tolerance", () => {
    const unit = createDraftUnit({
      projectId: "proj-1",
      granularity: "paragraph",
      targetWordCount: 100,
    });

    unit.content = "a ".repeat(85); // 85 words = within 80-120
    expect(meetsWordCountTarget(unit)).toBe(true);

    unit.content = "a ".repeat(50); // 50 words = too few
    expect(meetsWordCountTarget(unit)).toBe(false);

    unit.content = "a ".repeat(150); // 150 words = too many
    expect(meetsWordCountTarget(unit)).toBe(false);
  });

  it("should validate granularity", () => {
    expect(() => GranularitySchema.parse("sentence")).toThrow();
    expect(GranularitySchema.parse("chapter")).toBe("chapter");
  });
});
