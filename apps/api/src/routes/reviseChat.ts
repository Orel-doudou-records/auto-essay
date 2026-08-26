import { Hono } from "hono";
import { reviseUnitChat, streamReviseUnitChat } from "../services/reviseChatService.js";
import { ReviseChatBodySchema } from "../schemas/reviseChat.js";
import type { ModelClientFactory } from "../llm/client.js";

export function reviseChatRoutes(modelClientFactory: ModelClientFactory): Hono {
  const app = new Hono();

  app.post("/", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const unitId = c.req.param("unitId") as string;
    const body = ReviseChatBodySchema.parse(await c.req.json());
    const result = await reviseUnitChat(projectId, unitId, body.instruction, modelClientFactory);
    return c.json(result);
  });

  app.post("/stream", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const unitId = c.req.param("unitId") as string;
    const body = ReviseChatBodySchema.parse(await c.req.json());

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        await streamReviseUnitChat(projectId, unitId, body.instruction, (event) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }, modelClientFactory);
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return c.body(stream, 200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
  });

  return app;
}
