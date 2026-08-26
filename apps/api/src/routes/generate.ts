import { Hono } from "hono";
import { generateUnitContent } from "../services/generationService.js";
import type { ModelClientFactory } from "../llm/client.js";

export function generateRoutes(modelClientFactory: ModelClientFactory): Hono {
  const app = new Hono();

  app.post("/", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const unitId = c.req.param("unitId") as string;
    const unit = await generateUnitContent(projectId, unitId, modelClientFactory);
    return c.json({ unit });
  });

  return app;
}
