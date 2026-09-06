import { describe, expect, it } from "vitest";
import { StyleObservationSchema as SharedStyleObservationSchema } from "writing-engine";
import { createStyleObservation } from "../src/domain/styleObservation";
import { toWritingEngineStyleObservation } from "../src/editorial/writingEngineLitcraftAdapter";

describe("Writing Engine Litcraft observation adapter", () => {
  it("maps the complete AutoEssay observation without losing semantics", () => {
    const source = createStyleObservation({
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
        emotional: ["preserves the friction between the accounts"],
        reception: ["makes the reader experience the interruption"],
      },
      evidence: {
        excerpt: "The archive closes the sequence. The witness does not.",
        location: { label: "paragraph 4" },
      },
      provenance: {
        origin: "author_text_analysis",
        notes: ["reviewed by author"],
      },
      confidence: "high",
      maturity: "recurring_pattern",
    });

    const mapped = toWritingEngineStyleObservation(source);
    expect(() => SharedStyleObservationSchema.parse(mapped)).not.toThrow();

    expect(mapped).toEqual({
      id: source.id,
      authorId: source.authorId,
      sourceTextId: source.sourceTextId,
      situation: {
        signals: [
          { kind: "argumentative_function", value: "maintain a documentary contradiction" },
          { kind: "claim_type", value: "interpretation" },
          { kind: "claim_type", value: "counterclaim" },
          { kind: "source_regime", value: "institutional_archive" },
          { kind: "source_regime", value: "testimony" },
          { kind: "relation", value: "incompatible chronologies" },
          { kind: "tension", value: "archive versus situated memory" },
          { kind: "concept", value: "historical legitimacy" },
        ],
      },
      operations: source.formalOperations,
      effects: [
        { kind: "argumentative", statement: "prevents a false documentary synthesis" },
        { kind: "epistemic", statement: "keeps the source regimes distinct" },
        { kind: "emotional", statement: "preserves the friction between the accounts" },
        { kind: "reception", statement: "makes the reader experience the interruption" },
      ],
      evidence: source.evidence,
      provenance: source.provenance,
      confidence: source.confidence,
      maturity: source.maturity,
      createdAt: source.createdAt,
    });
  });

  it("does not invent a fallback signal when a valid observation has one content value", () => {
    const source = createStyleObservation({
      authorId: "author-1",
      sourceTextId: "text-2",
      contentConfiguration: {
        concepts: ["opacity"],
      },
      formalOperations: [
        {
          family: "figuration_genre",
          category: "ambiguity",
          trigger: "the source remains incomplete",
          operation: "leave the causal relation unresolved",
          target: "paragraph",
          observedEffect: "uncertainty remains legible",
        },
      ],
      observedEffects: {
        epistemic: ["marks the limit of the available evidence"],
      },
      evidence: { excerpt: "The record ends here." },
      provenance: { origin: "editorial_annotation" },
      confidence: "medium",
    });

    const mapped = toWritingEngineStyleObservation(source);

    expect(mapped.situation.signals).toEqual([
      { kind: "concept", value: "opacity" },
    ]);
  });
});
