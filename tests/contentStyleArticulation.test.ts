import { describe, expect, it } from "vitest";
import {
  ContentStyleArticulationSchema,
  canBecomeEditorialDecision,
  createContentStyleArticulation,
} from "../src/domain/contentStyleArticulation";

describe("ContentStyleArticulation", () => {
  it("should create a non-executable candidate by default", () => {
    const articulation = createContentStyleArticulation({
      scope: {
        level: "section",
        projectId: "project-1",
        sectionId: "section-1",
      },
      contentRelationIds: ["relation-1"],
      supportingObservationIds: ["observation-1"],
      stylisticOperations: [
        {
          family: "enunciation_structure",
          category: "claim_attribution",
          operation: "attribute each chronology to its documentary regime",
          target: "source_voice",
          rationale: "prevent the institutional archive from becoming a neutral narrator",
          intensity: "structuring",
        },
      ],
      intendedEffects: {
        content: ["keep both chronologies distinct"],
        form: ["maintain two identifiable regimes of enunciation"],
        argumentative: ["show the disagreement instead of resolving it"],
        epistemic: ["preserve the limits of each source"],
      },
      risks: [
        {
          description: "turn the documentary difference into theatrical opposition",
          impact: "medium",
          mitigation: "keep claims and confidence levels unchanged",
        },
      ],
      alternatives: [
        {
          description: "present the sources sequentially without formal contrast",
          tradeoffs: ["clearer chronology", "weaker perception of documentary friction"],
        },
      ],
      origin: "co_constructed",
    });

    expect(articulation.status).toBe("candidate");
    expect(canBecomeEditorialDecision(articulation)).toBe(false);
  });

  it("should allow only accepted or modified articulations to become decisions", () => {
    const base = createContentStyleArticulation({
      scope: { level: "project", projectId: "project-1" },
      contentRelationIds: ["relation-1"],
      stylisticOperations: [
        {
          family: "tone_lexicon",
          category: "conceptual_lexicon",
          operation: "reserve institutional vocabulary for attributed passages",
          target: "lexical_network",
          rationale: "avoid adopting the archive's categories as neutral language",
        },
      ],
      intendedEffects: {
        content: ["keep the source vocabulary attributed"],
        form: ["differentiate source and narrator lexicons"],
      },
      origin: "author_declared",
    });

    expect(canBecomeEditorialDecision({ ...base, status: "accepted" })).toBe(true);
    expect(canBecomeEditorialDecision({ ...base, status: "modified" })).toBe(true);
    expect(canBecomeEditorialDecision({ ...base, status: "rejected" })).toBe(false);
  });

  it("should reject an articulation without a content relation", () => {
    expect(() =>
      ContentStyleArticulationSchema.parse({
        id: "articulation-1",
        scope: { level: "project", projectId: "project-1" },
        contentRelationIds: [],
        stylisticOperations: [
          {
            family: "tone_lexicon",
            category: "language_register",
            operation: "separate the registers",
            target: "paragraph",
            rationale: "make the source difference audible",
          },
        ],
        intendedEffects: {
          content: ["preserve source differences"],
          form: ["differentiate registers"],
        },
        origin: "system_proposed",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    ).toThrow();
  });

  it("should reject an articulation without a formal operation", () => {
    expect(() =>
      ContentStyleArticulationSchema.parse({
        id: "articulation-1",
        scope: { level: "project", projectId: "project-1" },
        contentRelationIds: ["relation-1"],
        stylisticOperations: [],
        intendedEffects: {
          content: ["preserve source differences"],
          form: ["differentiate registers"],
        },
        origin: "system_proposed",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    ).toThrow();
  });

  it("should require explicit effects on both content and form", () => {
    expect(() =>
      ContentStyleArticulationSchema.parse({
        id: "articulation-1",
        scope: { level: "project", projectId: "project-1" },
        contentRelationIds: ["relation-1"],
        stylisticOperations: [
          {
            family: "creative_imperfection",
            category: "non_resolution",
            operation: "leave the contradiction unresolved",
            target: "transition",
            rationale: "avoid a false synthesis",
          },
        ],
        intendedEffects: {
          content: ["preserve the contradiction"],
          form: [],
        },
        origin: "system_proposed",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    ).toThrow();
  });
});
