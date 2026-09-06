import { Hono, type Context } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  mergeManuscriptUnitWithNext,
  splitManuscriptUnit,
  type ManuscriptGranularityResult,
} from "@auto-essay/core";
import { getWorkspace, putWorkspaceWhileLocked } from "../services/editorialWorkspaceStore.js";
import { getProject } from "../services/projectStore.js";
import { listUnits, replaceUnitsWhileLocked } from "../services/unitStore.js";
import { withProjectWriteLock } from "../services/projectWriteLock.js";

export function manuscriptGranularityRoutes(): Hono {
  const app = new Hono();

  app.post("/units/:unitId/split", async (c) => {
    const projectId = c.req.param("projectId") as string;
    await getProject(projectId);
    return changeGranularity(projectId, c.req.param("unitId") as string, splitManuscriptUnit, c);
  });

  app.post("/units/:unitId/merge-next", async (c) => {
    const projectId = c.req.param("projectId") as string;
    await getProject(projectId);
    return changeGranularity(projectId, c.req.param("unitId") as string, mergeManuscriptUnitWithNext, c);
  });

  return app;
}

async function changeGranularity(
  projectId: string,
  unitId: string,
  change: (manuscript: Parameters<typeof splitManuscriptUnit>[0], units: Parameters<typeof splitManuscriptUnit>[1], unitId: string) => ManuscriptGranularityResult,
  c: Context
) {
  return withProjectWriteLock(projectId, async () => {
    const workspace = await getWorkspace(projectId);
    const existingUnits = await listUnits(projectId);
    let result: ManuscriptGranularityResult;
    try {
      result = change(workspace.manuscript, existingUnits, unitId);
    } catch (error) {
      throw new HTTPException(400, { message: error instanceof Error ? error.message : "La granularité ne peut pas être modifiée." });
    }
    const replacedUnitIds = existingUnits
      .filter((unit) => !result.units.some((next) => next.id === unit.id))
      .map((unit) => unit.id);
    if (
      workspace.readings.some(
        (reading) => reading.scope?.kind === "paragraph" && replacedUnitIds.includes(reading.scope.unitId)
      )
    ) {
      throw new HTTPException(400, {
        message: "Cette unité a déjà une lecture éditoriale : sa granularité ne peut plus être modifiée automatiquement.",
      });
    }

    await replaceUnitsWhileLocked(projectId, result.units);
    try {
      await putWorkspaceWhileLocked(projectId, {
        manuscript: result.manuscript,
        distribution: workspace.distribution,
        profiles: workspace.profiles,
        articulations: workspace.articulations,
      });
    } catch (error) {
      await replaceUnitsWhileLocked(projectId, existingUnits);
      throw error;
    }
    return c.json({ units: result.units, unitIds: result.unitIds });
  });
}
