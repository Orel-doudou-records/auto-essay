import { z } from "zod";
import { DraftUnitStatusSchema } from "@auto-essay/core";

export const CreateUnitBodySchema = z.object({
  section: z.string().min(1),
  targetWordCount: z.number().int().min(1).optional(),
  content: z.string().optional(),
});

export const UpdateUnitBodySchema = z.object({
  content: z.string().optional(),
  status: DraftUnitStatusSchema.optional(),
  targetWordCount: z.number().int().min(1).optional(),
  thesis: z.string().optional(),
  version: z.number().int().nonnegative().optional(),
});
