import { Hono } from "hono";
import { evaluateUnit, markUnitVerified } from "../services/evaluationService.js";

export function evaluateRoutes(): Hono {
  const app = new Hono();

  app.post("/", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const unitId = c.req.param("unitId") as string;
    const result = await evaluateUnit(projectId, unitId);
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
