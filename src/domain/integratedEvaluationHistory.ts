import { z } from "zod";
import { EssayEvaluationSchema } from "./evaluation";
import { EditorialEffectEvaluationSchema } from "./editorialEffectEvaluation";
import { EditorialDecisionSchema } from "./editorialDecision";
import { IntegratedEvaluationContextSchema } from "./integratedEvaluationReadiness";
import { JudgeAssignmentSchema } from "./judgeRouting";
import { RevisionBriefSchema } from "./revision";

export const EvaluationJudgeAssignmentsSchema = z.object({
  documentary: JudgeAssignmentSchema,
  editorial: JudgeAssignmentSchema,
});
export type EvaluationJudgeAssignments = z.infer<
  typeof EvaluationJudgeAssignmentsSchema
>;

export const IntegratedEvaluationHistoryEntrySchema = z.object({
  id: z.string().min(1),
  recordedAt: z.string().datetime(),
  unitId: z.string().min(1),
  unitVersion: z.number().int().positive(),
  evaluation: EssayEvaluationSchema,
  editorialEvaluation: EditorialEffectEvaluationSchema,
  gates: z.object({
    documentaryIntegrity: z.enum(["pass", "fail"]),
    editorialCoherence: z.enum(["pass", "fail"]),
  }),
  finalVerdict: z.enum(["keep", "keep_with_minor_edits", "revise", "discard"]),
  brief: RevisionBriefSchema,
  assignments: EvaluationJudgeAssignmentsSchema,
  context: IntegratedEvaluationContextSchema,
  authorDecisions: z.array(EditorialDecisionSchema).min(1),
});
export type IntegratedEvaluationHistoryEntry = z.infer<
  typeof IntegratedEvaluationHistoryEntrySchema
>;

/**
 * Une entrée historique documente un jugement déjà rendu. Elle sert à la
 * consultation et ne peut ni modifier l’unité ni réactiver une décision.
 */
export function createIntegratedEvaluationHistoryEntry(
  input: IntegratedEvaluationHistoryEntry
): IntegratedEvaluationHistoryEntry {
  return IntegratedEvaluationHistoryEntrySchema.parse(input);
}
