import { Hono } from "hono";
import { evaluateUnit, markUnitVerified } from "../services/evaluationService.js";
import type { ModelClientFactory } from "../llm/client.js";

export function evaluateRoutes(modelClientFactory: ModelClientFactory): Hono {
  const app = new Hono();

  app.post("/", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const unitId = c.req.param("unitId") as string;
    const result = await evaluateUnit(projectId, unitId, modelClientFactory);
    return c.json(result);
  });

  app.post("/verify", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const unitId = c.req.param("unitId") as string;
    const unit = await markUnitVerified(projectId, unitId);
    return c.json({ unit });
  });

  return app;
}
