import {
  StyleObservationSchema as SharedStyleObservationSchema,
  type StyleObservation as SharedStyleObservation,
} from "writing-engine";
import type { StyleObservation } from "../domain/styleObservation";

export function toWritingEngineStyleObservation(
  source: StyleObservation
): SharedStyleObservation {
  const { contentConfiguration, observedEffects } = source;
  const signals = [
    ...(contentConfiguration.argumentativeFunction
      ? [
          {
            kind: "argumentative_function",
            value: contentConfiguration.argumentativeFunction,
          },
        ]
      : []),
    ...contentConfiguration.claimTypes.map((value) => ({
      kind: "claim_type",
      value,
    })),
    ...contentConfiguration.sourceRegimes.map((value) => ({
      kind: "source_regime",
      value,
    })),
    ...contentConfiguration.relations.map((value) => ({
      kind: "relation",
      value,
    })),
    ...contentConfiguration.tensions.map((value) => ({
      kind: "tension",
      value,
    })),
    ...contentConfiguration.concepts.map((value) => ({
      kind: "concept",
      value,
    })),
  ];
  const effects = [
    ...observedEffects.argumentative.map((statement) => ({
      kind: "argumentative",
      statement,
    })),
    ...observedEffects.epistemic.map((statement) => ({
      kind: "epistemic",
      statement,
    })),
    ...observedEffects.emotional.map((statement) => ({
      kind: "emotional",
      statement,
    })),
    ...observedEffects.reception.map((statement) => ({
      kind: "reception",
      statement,
    })),
  ];

  return SharedStyleObservationSchema.parse({
    id: source.id,
    authorId: source.authorId,
    sourceTextId: source.sourceTextId,
    situation: { signals },
    operations: source.formalOperations,
    effects,
    evidence: source.evidence,
    provenance: source.provenance,
    confidence: source.confidence,
    maturity: source.maturity,
    createdAt: source.createdAt,
  });
}
