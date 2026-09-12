import { Hono } from "hono";
import { z } from "zod";
import type { DraftUnit } from "@auto-essay/core";
import type { ConflictAssessment } from "writing-engine";
import {
  acceptCollaborativeParagraphRevision,
  rejectCollaborativeParagraphRevision,
} from "../services/collaborativeRevisionWork.js";
import {
  IntegrationMaterializationRecoveryError,
  integrateCollaborativeParagraphRevision,
} from "../services/collaborativeRevisionIntegration.js";
import type { CollaborativeRevisionWorkDto } from "../services/collaborativeRevisionWorkStore.js";

const AcceptRevisionWorkBodySchema = z.object({
  content: z.string(),
});

export const PublicRevisionWorkStatusSchema = z.enum([
  "working",
  "stale",
  "rejected",
  "integrated",
]);

export const RevisionWorkCommandStatusSchema = z.enum([
  "working",
  "stale",
  "rejected",
  "integrated",
  "candidate_stale_before_workspace",
  "conflict",
  "recovery_failed",
  "unsupported_projection_drift",
  "scope_mismatch",
]);

export const PublicCollaborativeRevisionWorkSchema = z.object({
  id: z.string().min(1),
  unitId: z.string().min(1),
  base: z.object({
    unitId: z.string().min(1),
    unitVersion: z.number().int().positive(),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    content: z.string(),
  }),
  proposedContent: z.string(),
  status: PublicRevisionWorkStatusSchema,
});

export type PublicCollaborativeRevisionWork = z.infer<
  typeof PublicCollaborativeRevisionWorkSchema
>;

export function toPublicCollaborativeRevisionWork(
  work: CollaborativeRevisionWorkDto
): PublicCollaborativeRevisionWork {
  return PublicCollaborativeRevisionWorkSchema.parse({
    id: work.id,
    unitId: work.unitId,
    base: work.base,
    proposedContent: work.proposedContent,
    status: work.status,
  });
}

function publicConflicts(assessment: ConflictAssessment) {
  return assessment.conflicts.map((conflict) => ({
    kind: conflict.kind,
    reason: conflict.reason,
  }));
}

function isScopeMismatch(error: unknown): boolean {
  return error instanceof Error && error.message.includes("scope mismatch");
}

function recoveryFailure(error: IntegrationMaterializationRecoveryError) {
  return {
    kind: "collaborative" as const,
    status: "recovery_failed" as const,
    code: error.code,
    message: error.message,
  };
}

export function revisionWorkRoutes(): Hono {
  const app = new Hono();

  app.post("/:workId/accept", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const unitId = c.req.param("unitId") as string;
    const workId = c.req.param("workId") as string;
    const parsed = AcceptRevisionWorkBodySchema.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) {
      return c.json(
        {
          kind: "collaborative",
          status: "invalid_request",
          message: "Le texte proposé est requis.",
        },
        400
      );
    }

    try {
      await acceptCollaborativeParagraphRevision({
        projectId,
        unitId,
        workId,
        content: parsed.data.content,
      });
      const integration = await integrateCollaborativeParagraphRevision({
        projectId,
        unitId,
        workId,
      });

      if (integration.status === "integrated") {
        return c.json({
          kind: "collaborative",
          status: "integrated",
          work: toPublicCollaborativeRevisionWork(integration.work),
          unit: integration.unit satisfies DraftUnit,
        });
      }
      if (integration.status === "unsupported_projection_drift") {
        return c.json(
          {
            kind: "collaborative",
            status: "unsupported_projection_drift",
            work: toPublicCollaborativeRevisionWork(integration.work),
            message: integration.reason,
          },
          409
        );
      }
      return c.json(
        {
          kind: "collaborative",
          status: integration.assessment.stale ? "stale" : "conflict",
          work: toPublicCollaborativeRevisionWork(integration.work),
          conflicts: publicConflicts(integration.assessment),
        },
        409
      );
    } catch (error) {
      if (error instanceof IntegrationMaterializationRecoveryError) {
        return c.json(recoveryFailure(error), 409);
      }
      if (isScopeMismatch(error)) {
        return c.json(
          {
            kind: "collaborative",
            status: "scope_mismatch",
            message: "Cette proposition ne correspond plus au texte sélectionné.",
          },
          409
        );
      }
      throw error;
    }
  });

  app.post("/:workId/reject", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const unitId = c.req.param("unitId") as string;
    const workId = c.req.param("workId") as string;

    try {
      const rejected = await rejectCollaborativeParagraphRevision({
        projectId,
        unitId,
        workId,
      });
      return c.json({
        kind: "collaborative",
        status: "rejected",
        work: toPublicCollaborativeRevisionWork(rejected.work),
      });
    } catch (error) {
      if (error instanceof IntegrationMaterializationRecoveryError) {
        return c.json(recoveryFailure(error), 409);
      }
      if (isScopeMismatch(error)) {
        return c.json(
          {
            kind: "collaborative",
            status: "scope_mismatch",
            message: "Cette proposition ne correspond plus au texte sélectionné.",
          },
          409
        );
      }
      throw error;
    }
  });

  return app;
}
