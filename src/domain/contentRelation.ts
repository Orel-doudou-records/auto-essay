import { z } from "zod";

/**
 * Portée éditoriale commune aux relations, articulations, décisions et plans.
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
    createdAt: z.string().datetime(),
  })
  .superRefine((relation, context) => {
    if (relation.type !== "silences" && relation.participants.length < 2) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["participants"],
        message: "This content relation requires at least two participants",
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
