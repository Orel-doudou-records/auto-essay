import { Hono } from "hono";
import { z } from "zod";
import {
  getScopeContext,
  setScopeSourceIncluded,
  type WorkspaceScope,
} from "../services/scopeContextService.js";

const ScopeKindSchema = z.enum(["node", "unit"]);
const SourceSelectionBodySchema = z.object({ included: z.boolean() });

export function scopeContextRoutes(): Hono {
  const app = new Hono();

  app.get("/:scopeKind/:scopeId", async (c) => {
    const projectId = c.req.param("projectId") as string;
    return c.json(
      await getScopeContext(projectId, scopeFromParams(c.req.param("scopeKind"), c.req.param("scopeId")))
    );
  });

  app.put("/:scopeKind/:scopeId/sources/:sourceId", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const scope = scopeFromParams(c.req.param("scopeKind"), c.req.param("scopeId"));
    const body = SourceSelectionBodySchema.parse(await c.req.json());
    return c.json(
      await setScopeSourceIncluded(
        projectId,
        scope,
        c.req.param("sourceId") as string,
        body.included
      )
    );
  });

  return app;
}

function scopeFromParams(kind: string | undefined, id: string | undefined): WorkspaceScope {
  return {
    kind: ScopeKindSchema.parse(kind),
    id: z.string().min(1).parse(id),
  };
}
