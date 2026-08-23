import { Hono } from "hono";
import { createModelClient } from "../llm/client.js";
import { StructuredClientAdapter } from "../llm/structuredAdapter.js";
import { DiffractionService } from "../services/diffractionService.js";
import {
  DiffractBatchBodySchema,
  DiffractBodySchema,
  DiffractivePipelineBodySchema,
} from "../schemas/diffract.js";

export function diffractRoutes(): Hono {
  const app = new Hono();

  app.post("/", async (c) => {
    const body = DiffractBodySchema.parse(await c.req.json());
    const service = await makeService();
    const reading = await service.diffract(body);
    return c.json(reading);
  });

  app.post("/batch", async (c) => {
    const body = DiffractBatchBodySchema.parse(await c.req.json());
    const service = await makeService();
    const result = await service.diffractBatch(body);
    return c.json(result);
  });

  app.post("/pipeline", async (c) => {
    const body = DiffractivePipelineBodySchema.parse(await c.req.json());
    const service = await makeService();
    const result = await service.runPipeline(body);
    return c.json(result);
  });

  return app;
}

async function makeService(): Promise<DiffractionService> {
  const client = await createModelClient();
  return new DiffractionService(new StructuredClientAdapter(client));
}
