import { z } from "zod";

/**
 * Portée éditoriale commune aux relations, articulations, décisions et plans.
 *
 * Contrat (ADR-006, R2-Q2) : `sectionId` et `paragraphId` sont des ids de
 * NŒUDS de l'ARBRE du manuscrit (parties), pas des positions textuelles.
 * Un id de nœud désigne toute la sous-partie (titre + texte propre +
 * descendants). Helpers de résolution/cohérence : src/domain/scopeResolution.ts
 */
export const EditorialScopeSchema = z
  .object({
    level: z.enum(["project", "section", "paragraph"]),
    projectId: z.string().min(1),
    sectionId: z.string().min(1).optional(),
    paragraphId: z.string().min(1).optional(),
  })
  .superRefine((scope, context) => {
    if (scope.level === "section" && scope.sectionId === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A section scope requires sectionId",
      });
    }

    if (scope.level === "paragraph") {
      if (scope.sectionId === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A paragraph scope requires sectionId",
        });
      }
      if (scope.paragraphId === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A paragraph scope requires paragraphId",
        });
      }
    }

    if (scope.level === "project" && (scope.sectionId || scope.paragraphId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A project scope cannot contain section or paragraph identifiers",
      });
    }

    if (scope.level === "section" && scope.paragraphId !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A section scope cannot contain paragraphId",
      });
    }
  });

export type EditorialScope = z.infer<typeof EditorialScopeSchema>;
export type EditorialScopeInput = z.input<typeof EditorialScopeSchema>;

export const ContentRelationTypeSchema = z.enum([
  "supports",
  "contradicts",
  "qualifies",
  "reframes",
  "silences",
  "translates",
  "appropriates",
  "changes_scale",
  "changes_temporality",
  "changes_source_regime",
  "differs_in_scope",
]);

export type ContentRelationType = z.infer<typeof ContentRelationTypeSchema>;

/**
 * Rôles canoniques des participants d'une relation atomique.
 * Le type de relation détermine la lecture de chaque position :
 * la relation est un atome binaire (sauf « silences », unaire), pas un
 * graphe n-aire ambigu. L'ordre des participants est signifiant.
 */
export const ContentRelationRoleMap: Record<
  ContentRelationType,
  readonly [string, string] | readonly [string]
> = {
  supports: ["supporting", "supported"],
  contradicts: ["challenging", "challenged"],
  qualifies: ["qualifying", "qualified"],
  reframes: ["reframing", "reframed"],
  silences: ["silenced"],
  translates: ["translating", "translated"],
  appropriates: ["appropriating", "appropriated"],
  changes_scale: ["scaling_from", "scaling_to"],
  changes_temporality: ["temporalizing_from", "temporalizing_to"],
  changes_source_regime: ["regime_from", "regime_to"],
  differs_in_scope: ["scope_a", "scope_b"],
};

export function relationRoleLabels(
  type: ContentRelationType
): readonly string[] {
  return ContentRelationRoleMap[type];
}

export const ContentRelationParticipantSchema = z.object({
  kind: z.enum(["source", "claim", "concept", "tension", "unit"]),
  id: z.string().min(1),
  role: z.string().min(1).optional(),
});

export type ContentRelationParticipant = z.infer<
  typeof ContentRelationParticipantSchema
>;
export type ContentRelationParticipantInput = z.input<
  typeof ContentRelationParticipantSchema
>;

/**
 * Relation explicite entre les objets de connaissance d'Auto Essay.
 * Le contrat décrit une relation sans fusionner les participants.
 */
export const ContentRelationSchema = z
  .object({
    id: z.string(),
    scope: EditorialScopeSchema,
    type: ContentRelationTypeSchema,
    participants: z.array(ContentRelationParticipantSchema).min(1),
    description: z.string().min(1),
    evidenceIds: z.array(z.string().min(1)).default([]),
    confidence: z.enum(["low", "medium", "high"]).default("medium"),
    origin: z.enum([
      "author_declared",
      "system_detected",
      "co_constructed",
    ]),
    status: z
      .enum([
        "detected",
        "surfaced",
        "accepted",
        "modified",
        "rejected",
        "active",
        "suspended",
        "resolved",
      ])
      .default("detected"),
    groupId: z.string().min(1).optional(),
    createdAt: z.string().datetime(),
  })
  .superRefine((relation, context) => {
    const expectedParticipants = relation.type === "silences" ? 1 : 2;

    if (relation.participants.length !== expectedParticipants) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["participants"],
        message:
          relation.type === "silences"
            ? "A silence relation must describe exactly one focal participant"
            : `A ${relation.type} relation must have exactly two participants`,
      });
    }
  });

export type ContentRelation = z.infer<typeof ContentRelationSchema>;
export type ContentRelationInput = z.input<typeof ContentRelationSchema>;

export function createContentRelation(
  partial: Omit<Partial<ContentRelationInput>, "id" | "createdAt"> & {
    scope: EditorialScopeInput;
    type: ContentRelationType;
    participants: ContentRelationParticipantInput[];
    description: string;
    origin: ContentRelationInput["origin"];
  }
): ContentRelation {
  return ContentRelationSchema.parse({
    id: crypto.randomUUID(),
    evidenceIds: [],
    confidence: "medium",
    status: "detected",
    createdAt: new Date().toISOString(),
    ...partial,
  });
}

export function assignRelationRoles<T extends { role?: string }>(
  type: ContentRelationType,
  participants: T[]
): Array<T & { role: string }> {
  const labels = relationRoleLabels(type);

  return participants.map((participant, index) => ({
    ...participant,
    role: participant.role ?? labels[index] ?? `participant_${index + 1}`,
  }));
}
