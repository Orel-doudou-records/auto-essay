import { Hono } from "hono";
import { createDiffractiveBatchRunner, createDiffractivePipeline, type StructuredModelClient } from "@auto-essay/core";
import type { ModelClientFactory } from "../llm/client.js";
import { StructuredClientAdapter } from "../llm/structuredAdapter.js";
import {
  DiffractBatchBodySchema,
  DiffractBodySchema,
} from "../schemas/diffract.js";

export function diffractRoutes(modelClientFactory: ModelClientFactory): Hono {
  const app = new Hono();

  app.post("/", async (c) => {
    const body = DiffractBodySchema.parse(await c.req.json());
    const pipeline = createDiffractivePipeline(await makeClient(modelClientFactory));
    const reading = await pipeline.diffractRequest(body);
    return c.json(reading);
  });

  app.post("/batch", async (c) => {
    const body = DiffractBatchBodySchema.parse(await c.req.json());
    const batch = createDiffractiveBatchRunner(await makeClient(modelClientFactory));
    const result = await batch.run(body);
    return c.json(result);
  });


  return app;
}

async function makeClient(modelClientFactory: ModelClientFactory): Promise<StructuredModelClient> {
  const client = await modelClientFactory();
  return new StructuredClientAdapter(client);
}
