import { ManuscriptImportPreviewSchema } from "@auto-essay/core";
import { z } from "zod";

const ManuscriptNameSchema = z.string().min(1).max(255);

export const PreviewManuscriptImportBodySchema = z.union([
  z.object({
    name: ManuscriptNameSchema,
    content: z.string().max(5_000_000),
  }),
  z.object({
    name: ManuscriptNameSchema,
    contentBase64: z.string().min(1).max(6_666_668),
  }),
]);

export const ConfirmManuscriptImportBodySchema = z.object({
  preview: ManuscriptImportPreviewSchema,
});

const ManuscriptReimportActionSchema = z.object({
  sectionId: z.string().min(1).max(255),
  action: z.enum(["add", "replace", "ignore"]),
  targetSectionId: z.string().min(1).max(255).optional(),
});

export const ConfirmManuscriptReimportBodySchema = z.object({
  preview: ManuscriptImportPreviewSchema,
  manuscriptUpdatedAt: z.string().datetime(),
  actions: z.array(ManuscriptReimportActionSchema).min(1).max(500),
});
