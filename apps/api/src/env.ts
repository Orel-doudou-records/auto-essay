import { z } from "zod";

// Charge .env (clé API, modèle) si présent — sans dépendance externe.
try {
  process.loadEnvFile();
} catch {
  // Pas de .env : on utilise l'environnement existant.
}

export const EnvSchema = z.object({
  OLLAMA_API_KEY: z.string().optional(),
  OLLAMA_BASE_URL: z.string().url().optional(),
  OLLAMA_MODEL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().url().optional(),
  OPENAI_MODEL: z.string().optional(),
  PORT: z.string().regex(/^\d+$/).optional(),
  AUTO_ESSAY_DATA_DIR: z.string().optional(),
});

export const env = EnvSchema.parse(process.env);
