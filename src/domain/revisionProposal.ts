import { z } from "zod";

export const RevisionProposalStatusSchema = z.enum(["available", "applied", "rejected", "stale"]);
export type RevisionProposalStatus = z.infer<typeof RevisionProposalStatusSchema>;

export const RevisionProposalSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  unitId: z.string(),
  sourceVersion: z.number().int().nonnegative(),
  before: z.string(),
  content: z.string(),
  status: RevisionProposalStatusSchema,
  appliedUnitVersion: z.number().int().nonnegative().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type RevisionProposal = z.infer<typeof RevisionProposalSchema>;
