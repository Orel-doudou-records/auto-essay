import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { loadEnvironmentFile, resolveModelClientConfig } from "./env.js";
import { createModelClientFactory } from "./llm/client.js";
import { logInfo } from "./observability/logger.js";

loadEnvironmentFile();
const modelClientConfig = resolveModelClientConfig(process.env);
const app = createApp({
  modelClientFactory: createModelClientFactory(modelClientConfig),
});
const port = Number(process.env.PORT || "3000");

logInfo(
  modelClientConfig.provider === "mock" ? "Fournisseur LLM simulé sélectionné." : "Fournisseur LLM sélectionné.",
  {
    provider: modelClientConfig.provider,
    ...(modelClientConfig.provider === "mock" ? {} : { model: modelClientConfig.model }),
  }
);

serve({
  fetch: app.fetch,
  port,
});
logInfo("API en écoute.", { port });
