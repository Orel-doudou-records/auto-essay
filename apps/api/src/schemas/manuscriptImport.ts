import { ManuscriptImportPreviewSchema } from "@auto-essay/core";
import { z } from "zod";

export const PreviewManuscriptImportBodySchema = z.object({
  name: z.string().min(1).max(255),
  content: z.string().max(5_000_000),
});

export const ConfirmManuscriptImportBodySchema = z.object({
  preview: ManuscriptImportPreviewSchema,
});
