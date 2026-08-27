import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  evaluateIntegratedUnit,
  evaluateUnit,
  getIntegratedEvaluationReadiness,
  markUnitVerified,
  selectEvaluationJudgeAssignments,
} from "../services/evaluationService.js";
import type { ModelClientFactory } from "../llm/client.js";
import type { JudgeRoutingPolicy } from "@auto-essay/core";

export function evaluateRoutes(
  modelClientFactory: ModelClientFactory,
  judgeRoutingPolicy: JudgeRoutingPolicy
): Hono {
  const app = new Hono();

  app.get("/judges", (c) => {
    try {
      return c.json({ assignments: selectEvaluationJudgeAssignments(judgeRoutingPolicy) });
    } catch (error) {
      throw new HTTPException(400, {
        message: error instanceof Error ? error.message : "invalid judge routing policy",
      });
    }
  });

  app.get("/readiness", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const unitId = c.req.param("unitId") as string;
    return c.json(await getIntegratedEvaluationReadiness(projectId, unitId));
  });

  app.post("/integrated", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const unitId = c.req.param("unitId") as string;
    try {
      return c.json(
        await evaluateIntegratedUnit(projectId, unitId, modelClientFactory, judgeRoutingPolicy)
      );
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("integrated evaluation unavailable:")) {
        throw new HTTPException(400, { message: error.message });
      }
      if (error instanceof Error && error.message.includes("judge")) {
        throw new HTTPException(400, { message: error.message });
      }
      throw error;
    }
  });

  app.post("/", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const unitId = c.req.param("unitId") as string;
    try {
      const result = await evaluateUnit(projectId, unitId, modelClientFactory, judgeRoutingPolicy);
      return c.json(result);
    } catch (error) {
      if (error instanceof Error && error.message.includes("judge")) {
        throw new HTTPException(400, { message: error.message });
      }
      throw error;
    }
  });

  app.post("/verify", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const unitId = c.req.param("unitId") as string;
    const unit = await markUnitVerified(projectId, unitId);
    return c.json({ unit });
  });

  return app;
}
