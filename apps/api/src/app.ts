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
import { errorHandler } from "./middleware/errorHandler.js";

export function createApp(): Hono {
  const app = new Hono();

  app.use(logger());
  app.use(cors({ origin: "*" }));

  app.get("/api/health", (c) => c.json({ status: "ok" }));

  app.route("/api/projects", projectsRoutes());
  app.route("/api/projects/:projectId/sources", sourcesRoutes());
  app.route("/api/projects/:projectId/units", unitsRoutes());
  app.route("/api/projects/:projectId/units/:unitId/generate", generateRoutes());
  app.route("/api/projects/:projectId/units/:unitId/revise-chat", reviseChatRoutes());
  app.route("/api/projects/:projectId/units/:unitId/evaluate", evaluateRoutes());
  app.route("/api/projects/:projectId/export", exportRoutes());
  app.route("/api/diffract", diffractRoutes());
  app.route("/api/demo", demoRoutes());

  app.onError(errorHandler);

  return app;
}
