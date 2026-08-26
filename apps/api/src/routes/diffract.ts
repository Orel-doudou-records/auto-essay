import { Hono } from "hono";
import type { ModelClientFactory } from "../llm/client.js";
import { StructuredClientAdapter } from "../llm/structuredAdapter.js";
import { DiffractionService } from "../services/diffractionService.js";
import {
  DiffractBatchBodySchema,
  DiffractBodySchema,
  DiffractivePipelineBodySchema,
} from "../schemas/diffract.js";

export function diffractRoutes(modelClientFactory: ModelClientFactory): Hono {
  const app = new Hono();

  app.post("/", async (c) => {
    const body = DiffractBodySchema.parse(await c.req.json());
    const service = await makeService(modelClientFactory);
    const reading = await service.diffract(body);
    return c.json(reading);
  });

  app.post("/batch", async (c) => {
    const body = DiffractBatchBodySchema.parse(await c.req.json());
    const service = await makeService(modelClientFactory);
    const result = await service.diffractBatch(body);
    return c.json(result);
  });

  app.post("/pipeline", async (c) => {
    const body = DiffractivePipelineBodySchema.parse(await c.req.json());
    const service = await makeService(modelClientFactory);
    const result = await service.runPipeline(body);
    return c.json(result);
  });

  return app;
}

async function makeService(modelClientFactory: ModelClientFactory): Promise<DiffractionService> {
  const client = await modelClientFactory();
  return new DiffractionService(new StructuredClientAdapter(client));
}
