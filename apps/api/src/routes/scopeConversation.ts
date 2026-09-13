import { Hono } from "hono";
import { z } from "zod";
import type { ModelClientFactory } from "../llm/client.js";
import { askScopeConversation, getScopeConversation } from "../services/scopeConversationService.js";
import { ScopeConversationScopeSchema } from "../services/scopeConversationStore.js";

const MessageBodySchema = z.object({ message: z.string().trim().min(1) });

export function scopeConversationRoutes(modelClientFactory: ModelClientFactory): Hono {
  const app = new Hono();

  app.get("/:scopeKind/:scopeId", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const scope = ScopeConversationScopeSchema.parse({
      kind: c.req.param("scopeKind"),
      id: c.req.param("scopeId"),
    });
    return c.json({ messages: await getScopeConversation(projectId, scope) });
  });

  app.post("/:scopeKind/:scopeId", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const scope = ScopeConversationScopeSchema.parse({
      kind: c.req.param("scopeKind"),
      id: c.req.param("scopeId"),
    });
    const body = MessageBodySchema.parse(await c.req.json());
    const messages = await askScopeConversation(
      projectId,
      scope,
      body.message,
      modelClientFactory
    );
    return c.json({ messages }, 201);
  });

  return app;
}
