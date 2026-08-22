import { z } from "zod";
import { SourceSchema } from "@auto-essay/core";

export const ImportSourcesBodySchema = z.object({
  files: z.array(
    z.object({
      name: z.string(),
      content: z.string(),
    })
  ),
});

export const UpdateSourceBodySchema = SourceSchema.partial().omit({ id: true });

export const CreateAnnotationBodySchema = z.object({
  id: z.string().optional(),
  quote: z.string(),
  note: z.string().optional(),
  pageStart: z.number().optional(),
  pageEnd: z.number().optional(),
  tags: z.array(z.string()).optional(),
});

export const UpdateAnnotationBodySchema = CreateAnnotationBodySchema.partial();
