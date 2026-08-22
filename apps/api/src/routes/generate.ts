import { Hono } from "hono";
import { generateUnitContent } from "../services/generationService.js";

export function generateRoutes(): Hono {
  const app = new Hono();

  app.post("/", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const unitId = c.req.param("unitId") as string;
    const unit = await generateUnitContent(projectId, unitId);
    return c.json({ unit });
  });

  return app;
}
