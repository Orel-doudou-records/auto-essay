import { z } from "zod";
import type { WriterEditorialProjection } from "./editorialProjection";

export const TransformationLocationSchema = z
  .object({
    excerpt: z.string().min(1),
    start: z.number().int().nonnegative().optional(),
    end: z.number().int().positive().optional(),
  })
  .superRefine((location, context) => {
    const hasStart = location.start !== undefined;
    const hasEnd = location.end !== undefined;

    if (hasStart !== hasEnd) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Transformation offsets require both start and end",
      });
    }

    if (
      location.start !== undefined &&
      location.end !== undefined &&
      location.end <= location.start
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Transformation end must be greater than start",
      });
    }
  });

export const TransformationTraceSchema = z.object({
  id: z.string(),
  unitId: z.string().min(1),
  unitVersion: z.number().int().positive(),
  projectionId: z.string().min(1),
  planId: z.string().min(1),
  directiveId: z.string().min(1),
  decisionId: z.string().min(1),
  articulationId: z.string().min(1),
  declaration: z.string().min(1),
  location: TransformationLocationSchema,
  status: z.literal("declared"),
  createdAt: z.string().datetime(),
});

export type TransformationTrace = z.infer<typeof TransformationTraceSchema>;

export interface TransformationDeclarationInput {
  directiveId: string;
  decisionId: string;
  articulationId: string;
  declaration: string;
  excerpt: string;
  start?: number;
  end?: number;
}

export function createTransformationTrace(
  unitId: string,
  unitVersion: number,
  projection: WriterEditorialProjection,
  input: TransformationDeclarationInput
): TransformationTrace {
  const directive = projection.directives.find(
    (candidate) => candidate.id === input.directiveId
  );

  if (!directive) {
    throw new Error(
      `Transformation references unknown directive ${input.directiveId}`
    );
  }

  if (
    directive.decisionId !== input.decisionId ||
    directive.articulationId !== input.articulationId
  ) {
    throw new Error(
      `Transformation provenance does not match directive ${input.directiveId}`
    );
  }

  if (projection.unitId !== unitId || projection.unitVersion !== unitVersion) {
    throw new Error("Transformation unit does not match writer projection");
  }

  return TransformationTraceSchema.parse({
    id: crypto.randomUUID(),
    unitId,
    unitVersion,
    projectionId: projection.id,
    planId: projection.planId,
    directiveId: input.directiveId,
    decisionId: input.decisionId,
    articulationId: input.articulationId,
    declaration: input.declaration,
    location: {
      excerpt: input.excerpt,
      start: input.start,
      end: input.end,
    },
    status: "declared",
    createdAt: new Date().toISOString(),
  });
}
