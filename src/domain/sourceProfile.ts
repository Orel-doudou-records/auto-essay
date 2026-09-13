import { z } from "zod";
import { IngestionStatusSchema } from "./ingestedDocument";

export const SourceProfileSectionSchema = z.object({
  sectionPath: z.array(z.string().min(1)).default([]),
  synopsis: z.string().min(1),
  blockIds: z.array(z.string().min(1)).min(1),
});

export type SourceProfileSection = z.infer<typeof SourceProfileSectionSchema>;

export const SourceComprehensionSchema = z
  .object({
    totalBlocks: z.number().int().nonnegative(),
    coveredBlockIds: z.array(z.string().min(1)).default([]),
    excludedBlockIds: z.array(z.string().min(1)).default([]),
    status: IngestionStatusSchema,
  })
  .superRefine((value, context) => {
    const covered = new Set(value.coveredBlockIds);
    const excluded = new Set(value.excludedBlockIds);

    if (covered.size !== value.coveredBlockIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["coveredBlockIds"],
        message: "Covered block ids must be unique",
      });
    }
    if (excluded.size !== value.excludedBlockIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["excludedBlockIds"],
        message: "Excluded block ids must be unique",
      });
    }
    for (const blockId of covered) {
      if (excluded.has(blockId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Block '${blockId}' cannot be both covered and excluded`,
        });
      }
    }

    const accounted = covered.size + excluded.size;
    if (accounted > value.totalBlocks) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Comprehension coverage exceeds total block count",
      });
    }
    if (value.status === "ready" && accounted !== value.totalBlocks) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["status"],
        message: "A ready source profile must account for every document block",
      });
    }
  });

export type SourceComprehension = z.infer<typeof SourceComprehensionSchema>;

/**
 * Représentation sémantique dérivée d'une source.
 *
 * Les champs historiques restent parseables pour les callers legacy, mais un
 * profil n'est considéré comme compris pour Corpus V2 que s'il possède un
 * fingerprint courant et une couverture de compréhension `ready`.
 */
export const SourceProfileSchema = z.object({
  sourceId: z.string().min(1),
  subjects: z.array(z.string().min(1)).default([]),
  concepts: z.array(z.string().min(1)).default([]),
  abstract: z.string().optional(),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  sections: z.array(SourceProfileSectionSchema).optional(),
  comprehension: SourceComprehensionSchema.optional(),
});

export type SourceProfile = z.infer<typeof SourceProfileSchema>;
export type SourceProfileInput = z.input<typeof SourceProfileSchema>;

export function createSourceProfile(input: SourceProfileInput): SourceProfile {
  return SourceProfileSchema.parse(input);
}

export function isComprehensionReady(profile: SourceProfile): boolean {
  return Boolean(profile.fingerprint && profile.comprehension?.status === "ready");
}
