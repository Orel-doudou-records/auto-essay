import { describe, expect, it } from "vitest";
import {
  createStyleObservation,
  ObservationContentConfigurationSchema,
  ObservationEvidenceSchema,
  ObservedStylisticOperationSchema,
  StyleObservationSchema,
} from "../src/domain/styleObservation";

describe("StyleObservation", () => {
  it("should create a situated content-form observation", () => {
    const observation = createStyleObservation({
      authorId: "author-1",
      sourceTextId: "text-1",
      contentConfiguration: {
        argumentativeFunction: "maintain a documentary contradiction",
        claimTypes: ["interpretation", "counterclaim"],
        sourceRegimes: ["institutional_archive", "testimony"],
        relations: ["incompatible chronologies"],
        tensions: ["archive versus situated memory"],
        concepts: ["historical legitimacy"],
      },
      formalOperations: [
        {
          family: "syntax_rhythm_musicality",
          category: "punctuation",
          trigger: "the testimony interrupts the institutional chronology",
          operation: "break the syntactic continuity with a short sentence",
          target: "transition",
          observedEffect: "the contradiction remains perceptible instead of being smoothed out",
          intensity: "structuring",
        },
      ],
      observedEffects: {
        argumentative: ["prevents a false documentary synthesis"],
        epistemic: ["keeps the source regimes distinct"],
        emotional: [],
        reception: ["makes the reader experience the interruption"],
      },
      evidence: {
        excerpt: "The archive closes the sequence. The witness does not.",
        location: { label: "paragraph 4" },
      },
      provenance: {
        origin: "author_text_analysis",
        notes: [],
      },
      confidence: "high",
    });

    expect(observation.id).toBeDefined();
    expect(observation.maturity).toBe("single_observation");
    expect(observation.formalOperations).toHaveLength(1);
    expect(observation.contentConfiguration.sourceRegimes).toEqual([
      "institutional_archive",
      "testimony",
    ]);
  });

  it("should not promote an observation to a signature by default", () => {
    const parsed = StyleObservationSchema.parse({
      id: "observation-1",
      authorId: "author-1",
      sourceTextId: "text-1",
      contentConfiguration: {
        argumentativeFunction: "introduce a speculative claim",
      },
      formalOperations: [
        {
          family: "enunciation_structure",
          category: "author_posture",
          trigger: "the available evidence remains incomplete",
          operation: "shift from assertion to a situated hypothesis",
          target: "narrator_voice",
          observedEffect: "the proposal remains forceful without claiming certainty",
        },
      ],
      observedEffects: {
        epistemic: ["marks the limit of the evidence"],
      },
      evidence: { location: { start: 10, end: 80 } },
      provenance: { origin: "editorial_annotation" },
      confidence: "medium",
      createdAt: new Date().toISOString(),
    });

    expect(parsed.maturity).toBe("single_observation");
  });

  it("should reject an observation without a content configuration", () => {
    expect(() =>
      ObservationContentConfigurationSchema.parse({
        claimTypes: [],
        sourceRegimes: [],
        relations: [],
        tensions: [],
        concepts: [],
      })
    ).toThrow();
  });

  it("should reject evidence without an excerpt or location", () => {
    expect(() => ObservationEvidenceSchema.parse({})).toThrow();
  });

  it("should reject an adjective presented as a complete stylistic operation", () => {
    expect(() =>
      ObservedStylisticOperationSchema.parse({
        family: "tone_lexicon",
        category: "language_register",
        operation: "lyrical",
        target: "paragraph",
      })
    ).toThrow();
  });

  it("should reject invalid text offsets", () => {
    expect(() =>
      ObservationEvidenceSchema.parse({
        location: { start: 20, end: 10 },
      })
    ).toThrow();
  });
});
