import { z } from "zod";

export const JudgeWorkTypeSchema = z.enum([
  "documentary_evaluation",
  "editorial_effect_evaluation",
]);
export type JudgeWorkType = z.infer<typeof JudgeWorkTypeSchema>;

export const JudgeRoleSchema = z.enum(["judge", "writer"]);
export type JudgeRole = z.infer<typeof JudgeRoleSchema>;

export const JudgeProfileSchema = z.object({
  id: z.string().min(1),
  role: JudgeRoleSchema,
  model: z.string().min(1),
  specialties: z.array(JudgeWorkTypeSchema).min(1),
});
export type JudgeProfile = z.infer<typeof JudgeProfileSchema>;

export const JudgeRoutingPolicySchema = z.object({
  judges: z.array(JudgeProfileSchema).min(1),
});
export type JudgeRoutingPolicy = z.infer<typeof JudgeRoutingPolicySchema>;

export const JudgeAssignmentSchema = z.object({
  workType: JudgeWorkTypeSchema,
  judge: z.object({
    id: z.string().min(1),
    role: z.literal("judge"),
    model: z.string().min(1),
    specialty: JudgeWorkTypeSchema,
  }),
  rationale: z.literal("specialty_matches_work_type"),
});
export type JudgeAssignment = z.infer<typeof JudgeAssignmentSchema>;

/**
 * Affecte un juge unique à un type de travail. Cette sélection est pure : elle
 * ne contacte pas de fournisseur et ne déclenche aucune évaluation.
 */
export function selectJudgeAssignment(
  policy: JudgeRoutingPolicy,
  workType: JudgeWorkType
): JudgeAssignment {
  const parsedPolicy = JudgeRoutingPolicySchema.parse(policy);
  const compatible = parsedPolicy.judges.filter(
    (candidate) =>
      candidate.role === "judge" && candidate.specialties.includes(workType)
  );

  if (compatible.length === 0) {
    throw new Error(`no compatible judge for ${workType}`);
  }
  if (compatible.length > 1) {
    throw new Error(`ambiguous judge routing for ${workType}`);
  }

  const judge = compatible[0];
  return JudgeAssignmentSchema.parse({
    workType,
    judge: {
      id: judge.id,
      role: "judge",
      model: judge.model,
      specialty: workType,
    },
    rationale: "specialty_matches_work_type",
  });
}
