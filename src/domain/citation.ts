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

export const CitationSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  sourceId: z.string().min(1),
  quote: z.string().min(1),
  locator: CitationLocatorSchema,
  context: z.string().optional(),
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
