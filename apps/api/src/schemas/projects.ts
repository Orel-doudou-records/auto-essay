import { z } from "zod";
import { ArgumentMapSchema, EssayVoiceSchema } from "@auto-essay/core";

export const CreateProjectBodySchema = z.object({
  title: z.string().min(1).max(200),
  thesisSeed: z.string().optional(),
});

export const UpdateProjectBodySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  thesisSeed: z.string().optional(),
  voiceConfig: EssayVoiceSchema.optional(),
  argumentMap: ArgumentMapSchema.optional(),
});

export const ProjectListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  updatedAt: z.string(),
});
