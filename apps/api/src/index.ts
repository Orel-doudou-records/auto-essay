import { serve } from "@hono/node-server";
import { createApp } from "./app.js";

// Charge .env (OLLAMA_API_KEY / OLLAMA_MODEL) - le serveur doit voir la clé
// comme la CLI (process.loadEnvFile, cwd = apps/api en npm workspace).
try {
  process.loadEnvFile();
} catch {
  // Pas de .env : environnement existant ou mode mock.
}
if (!process.env.OLLAMA_API_KEY && !process.env.OPENAI_API_KEY) {
  console.log(
    "INFO: aucune clé de modèle détectée — l'API utilisera le client simulé (mock)."
  );
}

const app = createApp();

const port = Number(process.env.PORT || "3000");

serve({
  fetch: app.fetch,
  port,
});

console.log(`API listening on http://localhost:${port}`);
