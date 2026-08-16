import { z } from "zod";

export const EnvSchema = z.object({
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().url().optional(),
  OPENAI_MODEL: z.string().optional(),
  PORT: z.string().regex(/^\d+$/).optional(),
  AUTO_ESSAY_DATA_DIR: z.string().optional(),
});

export const env = EnvSchema.parse(process.env);
