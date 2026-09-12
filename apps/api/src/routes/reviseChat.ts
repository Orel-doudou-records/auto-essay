import { Hono } from "hono";
import type { ModelClientFactory } from "../llm/client.js";
import { ReviseChatBodySchema } from "../schemas/reviseChat.js";
import {
  reviseUnitChat,
  streamReviseUnitChat,
  type ReviseChatResult,
} from "../services/reviseChatService.js";
import { toPublicCollaborativeRevisionWork } from "./revisionWork.js";

function publicReviseChatResult(result: ReviseChatResult) {
  if ("proposal" in result) return result;
  if (result.status === "created") {
    return {
      kind: "collaborative" as const,
      work: toPublicCollaborativeRevisionWork(result.work),
    };
  }
  if (result.status === "unsupported_projection_drift") {
    return {
      kind: "collaborative" as const,
      status: result.status,
      message: result.message,
    };
  }
  return {
    kind: "collaborative" as const,
    status: "candidate_stale_before_workspace" as const,
    message: "Le texte a changé pendant la préparation de la proposition. Relancez la révision.",
  };
}

function isCollaborativeCreationFailure(result: ReviseChatResult): boolean {
  return "kind" in result && result.kind === "collaborative" && result.status !== "created";
}

export function reviseChatRoutes(modelClientFactory: ModelClientFactory): Hono {
  const app = new Hono();

  app.post("/", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const unitId = c.req.param("unitId") as string;
    const body = ReviseChatBodySchema.parse(await c.req.json());
    const result = await reviseUnitChat(projectId, unitId, body.instruction, modelClientFactory);
    const response = publicReviseChatResult(result);
    if (isCollaborativeCreationFailure(result)) return c.json(response, 409);
    return c.json(response);
  });

  app.post("/stream", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const unitId = c.req.param("unitId") as string;
    const body = ReviseChatBodySchema.parse(await c.req.json());

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        await streamReviseUnitChat(projectId, unitId, body.instruction, (event) => {
          const publicEvent = event.type === "done" && event.payload
            ? {
                ...event,
                payload: publicReviseChatResult(event.payload as ReviseChatResult),
              }
            : event;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(publicEvent)}\n\n`));
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
