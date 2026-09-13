import { z } from "zod";
import { VerificationStatusSchema } from "./source";

export const CitationLocatorKindSchema = z.enum([
  "page",
  "chapter",
  "section",
  "timestamp",
  "url_fragment",
  "other",
]);

export type CitationLocatorKind = z.infer<typeof CitationLocatorKindSchema>;

export const CitationLocatorSchema = z.object({
  kind: CitationLocatorKindSchema,
  value: z.string().min(1),
});

export type CitationLocator = z.infer<typeof CitationLocatorSchema>;

/**
 * Optional provenance for citations promoted from CorpusExplorer.
 * Kept local to Citation to avoid a citation <-> IngestedDocument schema cycle.
 */
export const CitationRetrievalProvenanceSchema = z
  .object({
    retrievedPassageId: z.string().min(1),
    documentId: z.string().min(1),
    blockId: z.string().min(1),
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
    documentFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .refine(({ start, end }) => start < end, {
    message: "Citation retrieval provenance start must be less than end",
  });

export type CitationRetrievalProvenance = z.infer<
  typeof CitationRetrievalProvenanceSchema
>;

export const CitationSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  sourceId: z.string().min(1),
  quote: z.string().min(1),
  locator: CitationLocatorSchema,
  context: z.string().optional(),
  retrievalProvenance: CitationRetrievalProvenanceSchema.optional(),
  verificationStatus: VerificationStatusSchema,
  createdAt: z.string().datetime(),
});

export type Citation = z.infer<typeof CitationSchema>;

const CharacterRangeSchema = z
  .object({
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
  })
  .refine(({ start, end }) => start < end, {
    message: "A character range start must be less than its end",
  });

export const CitationUseSchema = z.object({
  citationId: z.string().min(1),
  draftUnitId: z.string().min(1),
  draftUnitVersion: z.number().int().min(1),
  characterRange: CharacterRangeSchema.optional(),
});

export type CitationUse = z.infer<typeof CitationUseSchema>;
