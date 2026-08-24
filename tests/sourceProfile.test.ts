import { describe, expect, it } from "vitest";
import {
  SourceProfileSchema,
  createSourceProfile,
} from "../src/domain/sourceProfile";

describe("SourceProfile (domaine)", () => {
  it("crée un profil avec sujets + concepts + abstract", () => {
    const profile = createSourceProfile({
      sourceId: "src-1",
      subjects: ["diaspora", "science-fiction"],
      concepts: ["errance spatiale"],
      abstract: "Une lecture de la diaspora comme fiction.",
    });
    expect(profile.sourceId).toBe("src-1");
    expect(profile.subjects).toHaveLength(2);
    expect(profile.abstract).toContain("diaspora");
  });

  it("applique les défauts (sujets/concepts vides)", () => {
    const profile = SourceProfileSchema.parse({ sourceId: "src-1" });
    expect(profile.subjects).toEqual([]);
    expect(profile.concepts).toEqual([]);
    expect(profile.abstract).toBeUndefined();
  });

  it("refuse un sourceId vide", () => {
    const result = SourceProfileSchema.safeParse({ sourceId: "" });
    expect(result.success).toBe(false);
  });
});