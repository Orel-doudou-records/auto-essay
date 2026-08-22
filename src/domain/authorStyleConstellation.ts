import { z } from "zod";
import {
  StylisticOperationCategorySchema,
  StylisticOperationFamilySchema,
  type StyleObservation,
} from "./styleObservation";
import { unique } from "../utils/array";

export const AuthorStyleDeclarationSchema = z.object({
  id: z.string(),
  authorId: z.string().min(1),
  statement: z.string().min(1),
  scope: z.enum(["global", "genre", "project", "unit"]).default("global"),
  status: z.enum(["proposed", "validated", "rejected"]).default("proposed"),
  provenance: z.string().min(1),
});

export type AuthorStyleDeclaration = z.infer<
  typeof AuthorStyleDeclarationSchema
>;

export const ObservedPracticeSummarySchema = z.object({
  family: StylisticOperationFamilySchema,
  category: StylisticOperationCategorySchema,
  observationIds: z.array(z.string().min(1)).min(1),
  operations: z.array(z.string().min(1)).min(1),
  triggers: z.array(z.string().min(1)).min(1),
  observedEffects: z.array(z.string().min(1)).min(1),
  confidence: z.enum(["low", "medium", "high"]),
});

export type ObservedPracticeSummary = z.infer<
  typeof ObservedPracticeSummarySchema
>;

/**
 * Vue dérivée d'un corpus d'observations et de déclarations validées.
 * Elle sert à la consultation et à l'analyse longitudinale ; elle n'est jamais
 * une entrée exécutable pour le writer ou le ProjectionCompiler.
 */
export const AuthorStyleConstellationSchema = z.object({
  authorId: z.string().min(1),
  observationIds: z.array(z.string().min(1)).default([]),
  observedPractices: z.array(ObservedPracticeSummarySchema).default([]),
  declaredPreferences: z.array(AuthorStyleDeclarationSchema).default([]),
  validatedSignatures: z.array(z.string().min(1)).default([]),
  productiveTensions: z.array(z.string().min(1)).default([]),
  unwantedDrifts: z.array(z.string().min(1)).default([]),
  ethicalBoundary: z.object({
    preserveMechanismsNotSurface: z.literal(true),
    forbiddenVerbatimReuse: z.literal(true),
    notes: z.array(z.string().min(1)).default([]),
  }),
  derivedAt: z.string().datetime(),
});

export type AuthorStyleConstellation = z.infer<
  typeof AuthorStyleConstellationSchema
>;

export interface DeriveAuthorStyleConstellationInput {
  authorId: string;
  observations: StyleObservation[];
  declarations?: AuthorStyleDeclaration[];
  validatedSignatures?: string[];
  productiveTensions?: string[];
  unwantedDrifts?: string[];
  ethicalNotes?: string[];
}

export function deriveAuthorStyleConstellation(
  input: DeriveAuthorStyleConstellationInput
): AuthorStyleConstellation {
  const observations = input.observations.filter(
    (observation) => observation.authorId === input.authorId
  );
  const declarations = (input.declarations ?? []).filter(
    (declaration) => declaration.authorId === input.authorId
  );
  const groupedPractices = new Map<
    string,
    {
      family: ObservedPracticeSummary["family"];
      category: ObservedPracticeSummary["category"];
      observationIds: Set<string>;
      operations: Set<string>;
      triggers: Set<string>;
      effects: Set<string>;
      confidenceLevels: Array<StyleObservation["confidence"]>;
    }
  >();

  for (const observation of observations) {
    const effects = flattenObservedEffects(observation);

    for (const operation of observation.formalOperations) {
      const key = `${operation.family}:${operation.category}`;
      const current = groupedPractices.get(key) ?? {
        family: operation.family,
        category: operation.category,
        observationIds: new Set<string>(),
        operations: new Set<string>(),
        triggers: new Set<string>(),
        effects: new Set<string>(),
        confidenceLevels: [],
      };

      current.observationIds.add(observation.id);
      current.operations.add(operation.operation);
      current.triggers.add(operation.trigger);
      current.effects.add(operation.observedEffect);
      effects.forEach((effect) => current.effects.add(effect));
      current.confidenceLevels.push(observation.confidence);
      groupedPractices.set(key, current);
    }
  }

  const observedPractices = [...groupedPractices.values()].map((practice) =>
    ObservedPracticeSummarySchema.parse({
      family: practice.family,
      category: practice.category,
      observationIds: [...practice.observationIds],
      operations: [...practice.operations],
      triggers: [...practice.triggers],
      observedEffects: [...practice.effects],
      confidence: weakestConfidence(practice.confidenceLevels),
    })
  );

  return AuthorStyleConstellationSchema.parse({
    authorId: input.authorId,
    observationIds: observations.map((observation) => observation.id),
    observedPractices,
    declaredPreferences: declarations,
    validatedSignatures: unique(input.validatedSignatures ?? []),
    productiveTensions: unique(input.productiveTensions ?? []),
    unwantedDrifts: unique(input.unwantedDrifts ?? []),
    ethicalBoundary: {
      preserveMechanismsNotSurface: true,
      forbiddenVerbatimReuse: true,
      notes: unique(input.ethicalNotes ?? []),
    },
    derivedAt: new Date().toISOString(),
  });
}

function flattenObservedEffects(observation: StyleObservation): string[] {
  return unique([
    ...observation.observedEffects.argumentative,
    ...observation.observedEffects.epistemic,
    ...observation.observedEffects.emotional,
    ...observation.observedEffects.reception,
  ]);
}

function weakestConfidence(
  values: Array<StyleObservation["confidence"]>
): StyleObservation["confidence"] {
  if (values.includes("low")) {
    return "low";
  }
  if (values.includes("medium")) {
    return "medium";
  }
  return "high";
}

