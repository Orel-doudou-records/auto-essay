import { describe, expect, it } from "vitest";
import { LEGACY_STYLE_PROFILE_REMOVED } from "../src/domain/styleProfile";
import { LEGACY_LITERACRAFT_STYLE_ENGINE_REMOVED } from "../src/style/styleEngine";
import { LEGACY_LITERACRAFT_PROMPTS_REMOVED } from "../src/style/prompts";

describe("initial Literacraft prototype migration", () => {
  it("keeps only explicit migration tombstones", () => {
    expect(LEGACY_STYLE_PROFILE_REMOVED).toBe(true);
    expect(LEGACY_LITERACRAFT_STYLE_ENGINE_REMOVED).toBe(true);
    expect(LEGACY_LITERACRAFT_PROMPTS_REMOVED).toBe(true);
  });
});
