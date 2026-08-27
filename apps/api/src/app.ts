import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { projectsRoutes } from "./routes/projects.js";
import { sourcesRoutes } from "./routes/sources.js";
import { unitsRoutes } from "./routes/units.js";
import { generateRoutes } from "./routes/generate.js";
import { reviseChatRoutes } from "./routes/reviseChat.js";
import { evaluateRoutes } from "./routes/evaluate.js";
import { exportRoutes } from "./routes/export.js";
import { diffractRoutes } from "./routes/diffract.js";
import { demoRoutes } from "./routes/demo.js";
import { editorialRoutes } from "./routes/editorial.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { createModelClientFactory, type ModelClientFactory } from "./llm/client.js";
import { DEFAULT_JUDGE_ROUTING_POLICY, type JudgeRoutingPolicy } from "@auto-essay/core";
import { listProjects } from "./services/projectStore.js";
import { createAutomaticDiffractiveReadingWorker } from "./services/automaticDiffractiveReadingWorker.js";

export interface AppOptions {
  modelClientFactory?: ModelClientFactory;
  judgeRoutingPolicy?: JudgeRoutingPolicy;
}

export function createApp(options: AppOptions = {}): Hono {
  const app = new Hono();
  const modelClientFactory = options.modelClientFactory ?? createModelClientFactory({ provider: "mock" });
  const judgeRoutingPolicy = options.judgeRoutingPolicy ?? DEFAULT_JUDGE_ROUTING_POLICY;
  const automaticReadingWorker = createAutomaticDiffractiveReadingWorker(modelClientFactory);

  queueMicrotask(() => {
    void listProjects().then((projects) =>
      Promise.all(projects.map((project) => automaticReadingWorker.resumePending(project.id)))
    );
  });

  app.use(logger());
  app.use(cors({ origin: "*" }));

  app.get("/api/health", (c) => c.json({ status: "ok" }));

  app.route("/api/projects", projectsRoutes());
  app.route("/api/projects/:projectId/sources", sourcesRoutes());
  app.route("/api/projects/:projectId/units", unitsRoutes());
  app.route("/api/projects/:projectId/units/:unitId/generate", generateRoutes(modelClientFactory));
  app.route("/api/projects/:projectId/units/:unitId/revise-chat", reviseChatRoutes(modelClientFactory));
  app.route(
    "/api/projects/:projectId/units/:unitId/evaluate",
    evaluateRoutes(modelClientFactory, judgeRoutingPolicy)
  );
  app.route("/api/projects/:projectId/export", exportRoutes());
  app.route("/api/projects/:projectId/editorial", editorialRoutes(modelClientFactory));
  app.route("/api/diffract", diffractRoutes(modelClientFactory));
  app.route("/api/demo", demoRoutes());

  app.onError(errorHandler);

  return app;
}
