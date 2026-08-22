import { Hono } from "hono";
import { exportMarkdown } from "../services/exportService.js";
import { ExportBodySchema } from "../schemas/export.js";

export function exportRoutes(): Hono {
  const app = new Hono();

  app.post("/", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const body = ExportBodySchema.parse(await c.req.json());
    const result = await exportMarkdown(projectId, body.unitIds);
    return c.json(result);
  });

  return app;
}
