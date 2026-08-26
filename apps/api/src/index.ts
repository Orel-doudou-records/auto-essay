import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { loadEnvironmentFile, resolveModelClientConfig } from "./env.js";
import { createModelClientFactory } from "./llm/client.js";

loadEnvironmentFile();
const modelClientConfig = resolveModelClientConfig(process.env);
const app = createApp({
  modelClientFactory: createModelClientFactory(modelClientConfig),
});
const port = Number(process.env.PORT || "3000");

if (modelClientConfig.provider === "mock") {
  console.log("INFO: fournisseur LLM simulé sélectionné.");
} else {
  console.log(
    `INFO: fournisseur LLM ${modelClientConfig.provider} sélectionné${
      modelClientConfig.model ? ` (modèle ${modelClientConfig.model})` : ""
    }.`
  );
}

serve({
  fetch: app.fetch,
  port,
});
console.log(`API listening on http://localhost:${port}`);
