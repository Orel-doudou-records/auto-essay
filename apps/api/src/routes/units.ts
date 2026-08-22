import { Hono } from "hono";
import { listUnits, createUnit, getUnit, updateUnit, deleteUnit } from "../services/unitStore.js";
import { CreateUnitBodySchema, UpdateUnitBodySchema } from "../schemas/units.js";

export function unitsRoutes(): Hono {
  const app = new Hono();

  app.get("/", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const units = await listUnits(projectId);
    return c.json({ units });
  });

  app.post("/", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const body = CreateUnitBodySchema.parse(await c.req.json());
    const unit = await createUnit(projectId, {
      granularity: "paragraph",
      targetWordCount: body.targetWordCount,
      content: body.content ?? "",
      status: "drafting",
      evidencePack: { sourceIds: [], keyCitations: [], supportingClaimIds: [], objections: [], authorNotes: undefined },
      thesis: body.section,
      contextInPlan: {
        section: body.section,
      },
    });
    return c.json({ unit }, 201);
  });

  app.get("/:unitId", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const unit = await getUnit(projectId, c.req.param("unitId") as string);
    if (!unit) return c.json({ error: "unit not found" }, 404);
    return c.json({ unit });
  });

  app.patch("/:unitId", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const body = UpdateUnitBodySchema.parse(await c.req.json());
    const unit = await updateUnit(projectId, c.req.param("unitId") as string, body);
    if (!unit) return c.json({ error: "unit not found" }, 404);
    return c.json({ unit });
  });

  app.delete("/:unitId", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const ok = await deleteUnit(projectId, c.req.param("unitId") as string);
    if (!ok) return c.json({ error: "unit not found" }, 404);
    return c.json({ deleted: true });
  });

  return app;
}
