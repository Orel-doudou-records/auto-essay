import { z } from "zod";
import { CitationLocatorSchema } from "./citation";

export const IngestionStatusSchema = z.enum([
  "ready",
  "degraded",
  "unreadable",
]);

export type IngestionStatus = z.infer<typeof IngestionStatusSchema>;

export const IngestedBlockSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  order: z.number().int().nonnegative(),
  text: z.string().min(1),
  sectionPath: z.array(z.string().min(1)).default([]),
  locator: CitationLocatorSchema,
});

export type IngestedBlock = z.infer<typeof IngestedBlockSchema>;

export const IngestedDocumentSchema = z
  .object({
    id: z.string().min(1),
    sourceId: z.string().min(1),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    blocks: z.array(IngestedBlockSchema),
    ingestionStatus: IngestionStatusSchema,
    diagnostics: z.array(z.string().min(1)).default([]),
  })
  .superRefine((document, context) => {
    const ids = new Set<string>();
    const orders = new Set<number>();

    for (const [index, block] of document.blocks.entries()) {
      if (ids.has(block.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["blocks", index, "id"],
          message: `Duplicate ingested block id '${block.id}'`,
        });
      }
      ids.add(block.id);

      if (orders.has(block.order)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["blocks", index, "order"],
          message: `Duplicate ingested block order '${block.order}'`,
        });
      }
      orders.add(block.order);
    }

    if (document.ingestionStatus === "ready" && document.blocks.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ingestionStatus"],
        message: "A ready ingested document must contain at least one block",
      });
    }
  });

export type IngestedDocument = z.infer<typeof IngestedDocumentSchema>;

export const IngestedSpanRefSchema = z
  .object({
    documentId: z.string().min(1),
    blockId: z.string().min(1),
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
  })
  .refine(({ start, end }) => start < end, {
    message: "An ingested span start must be less than its end",
  });

export type IngestedSpanRef = z.infer<typeof IngestedSpanRefSchema>;

export function readIngestedSpan(
  document: IngestedDocument,
  spanInput: IngestedSpanRef
): string {
  const span = IngestedSpanRefSchema.parse(spanInput);
  if (span.documentId !== document.id) {
    throw new Error(`Span targets document '${span.documentId}', not '${document.id}'`);
  }

  const block = document.blocks.find((item) => item.id === span.blockId);
  if (!block) {
    throw new Error(`Ingested block '${span.blockId}' not found in document '${document.id}'`);
  }
  if (span.end > block.text.length) {
    throw new Error(`Span end ${span.end} exceeds block '${block.id}' length ${block.text.length}`);
  }

  return block.text.slice(span.start, span.end);
}
