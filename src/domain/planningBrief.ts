import { z } from "zod";
import type { Manuscript, ManuscriptChild } from "./manuscript.js";

export const PlanningHypothesisStatusSchema = z.enum([
  "emergent",
  "supported",
  "contested",
  "under_documented",
  "rejected",
]);

export const PlanningHypothesisSchema = z.object({
  statement: z.string().min(1),
  status: PlanningHypothesisStatusSchema,
  sourceRefs: z.array(z.string().min(1)).default([]),
  note: z.string().min(1).optional(),
});

export type PlanningHypothesis = z.infer<typeof PlanningHypothesisSchema>;
export type PlanningHypothesisInput = z.input<typeof PlanningHypothesisSchema>;

export const PlanningGapSchema = z.object({
  description: z.string().min(1),
  consequence: z.string().min(1),
  neededEvidence: z.string().min(1).optional(),
});

export type PlanningGap = z.infer<typeof PlanningGapSchema>;
export type PlanningGapInput = z.input<typeof PlanningGapSchema>;

/**
 * Stable reference to the literary scope described by a planning brief.
 * Node kinds remain intentionally semantic-free: part/chapter/section are
 * author-facing roles of ManuscriptNode, not new domain hierarchies.
 * A planned paragraph is addressable before a DraftUnit exists through its
 * canonical PlanEntry id.
 */
export const PlanningScopeRefSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("manuscript"),
    projectId: z.string().min(1),
    manuscriptId: z.string().min(1),
  }),
  z.object({
    kind: z.literal("node"),
    projectId: z.string().min(1),
    manuscriptId: z.string().min(1),
    nodeId: z.string().min(1),
  }),
  z.object({
    kind: z.literal("plan_entry"),
    projectId: z.string().min(1),
    manuscriptId: z.string().min(1),
    planEntryId: z.string().min(1),
  }),
]);

export type PlanningScopeRef = z.infer<typeof PlanningScopeRefSchema>;
export type PlanningScopeRefInput = z.input<typeof PlanningScopeRefSchema>;

export const PlanningBriefSchema = z
  .object({
    id: z.string().min(1),
    projectId: z.string().min(1),
    scopeRef: PlanningScopeRefSchema,
    version: z.number().int().positive(),
    intention: z.string().min(1).optional(),
    question: z.string().min(1),
    angleOrFunction: z.string().min(1).optional(),
    hypotheses: z.array(PlanningHypothesisSchema).default([]),
    gaps: z.array(PlanningGapSchema).default([]),
    constraints: z.array(z.string().min(1)).default([]),
    sourceRefs: z.array(z.string().min(1)).default([]),
    rationale: z.string().min(1).optional(),
    supersedesBriefId: z.string().min(1).optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .superRefine((brief, context) => {
    if (brief.scopeRef.projectId !== brief.projectId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scopeRef", "projectId"],
        message: "Planning brief and scope must belong to the same project",
      });
    }
    if (brief.version === 1 && brief.supersedesBriefId !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["supersedesBriefId"],
        message: "The first planning brief version cannot supersede another brief",
      });
    }
    if (brief.version > 1 && brief.supersedesBriefId === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["supersedesBriefId"],
        message: "A planning brief version after v1 must supersede its predecessor",
      });
    }
  });

export type PlanningBrief = z.infer<typeof PlanningBriefSchema>;

export interface CreatePlanningBriefInput {
  manuscript: Manuscript;
  scopeRef: PlanningScopeRefInput;
  question: string;
  intention?: string;
  angleOrFunction?: string;
  hypotheses?: PlanningHypothesisInput[];
  gaps?: PlanningGapInput[];
  constraints?: string[];
  sourceRefs?: string[];
  rationale?: string;
}

export function createPlanningBrief(input: CreatePlanningBriefInput): PlanningBrief {
  const scopeRef = PlanningScopeRefSchema.parse(input.scopeRef);
  assertScopeExists(input.manuscript, scopeRef);
  const now = new Date().toISOString();

  return PlanningBriefSchema.parse({
    id: crypto.randomUUID(),
    projectId: input.manuscript.projectId,
    scopeRef,
    version: 1,
    question: input.question,
    intention: input.intention,
    angleOrFunction: input.angleOrFunction,
    hypotheses: input.hypotheses ?? [],
    gaps: input.gaps ?? [],
    constraints: input.constraints ?? [],
    sourceRefs: input.sourceRefs ?? [],
    rationale: input.rationale,
    createdAt: now,
    updatedAt: now,
  });
}

export function supersedePlanningBrief(
  current: PlanningBrief,
  manuscript: Manuscript,
  changes: Partial<Pick<
    PlanningBrief,
    | "question"
    | "intention"
    | "angleOrFunction"
    | "hypotheses"
    | "gaps"
    | "constraints"
    | "sourceRefs"
    | "rationale"
  >> = {}
): PlanningBrief {
  assertScopeExists(manuscript, current.scopeRef);
  if (
    current.projectId !== manuscript.projectId ||
    current.scopeRef.manuscriptId !== manuscript.id
  ) {
    throw new Error("Planning brief does not belong to this manuscript");
  }

  const now = new Date().toISOString();
  return PlanningBriefSchema.parse({
    ...current,
    ...changes,
    id: crypto.randomUUID(),
    version: current.version + 1,
    supersedesBriefId: current.id,
    createdAt: now,
    updatedAt: now,
  });
}

export function isPlanningScopeResolvable(
  manuscript: Manuscript,
  scopeRef: PlanningScopeRef
): boolean {
  try {
    assertScopeExists(manuscript, scopeRef);
    return true;
  } catch {
    return false;
  }
}

function assertScopeExists(manuscript: Manuscript, scopeRef: PlanningScopeRef): void {
  if (scopeRef.projectId !== manuscript.projectId) {
    throw new Error("Planning scope project does not match manuscript project");
  }
  if (scopeRef.manuscriptId !== manuscript.id) {
    throw new Error("Planning scope manuscript does not match manuscript id");
  }
  if (scopeRef.kind === "manuscript") return;

  let found = false;
  const visit = (child: ManuscriptChild): void => {
    if (found || child.kind === "leaf") return;
    if (scopeRef.kind === "node" && child.id === scopeRef.nodeId) {
      found = true;
      return;
    }
    if (
      scopeRef.kind === "plan_entry" &&
      child.plan?.some((entry) => entry.id === scopeRef.planEntryId)
    ) {
      found = true;
      return;
    }
    for (const nested of child.children) visit(nested);
  };
  for (const child of manuscript.tree) visit(child);

  if (!found) {
    const id = scopeRef.kind === "node" ? scopeRef.nodeId : scopeRef.planEntryId;
    throw new Error(`Unknown planning scope: ${id}`);
  }
}
