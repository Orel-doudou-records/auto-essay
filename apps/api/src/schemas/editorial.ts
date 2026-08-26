import { z } from "zod";
import {
  BibliographyDistributionEntrySchema,
  ContentStyleArticulationSchema,
  ManuscriptSchema,
  SourceProfileSchema,
} from "@auto-essay/core";

export const EditorialWorkspaceBodySchema = z.object({
  manuscript: ManuscriptSchema,
  distribution: z.array(BibliographyDistributionEntrySchema).default([]),
  profiles: z.array(SourceProfileSchema).default([]),
  articulations: z.array(ContentStyleArticulationSchema).default([]),
});

export const ReadSectionBodySchema = z.object({
  statement: z.string().min(1),
  claimIds: z.array(z.string().min(1)).default([]),
  sourceIds: z.array(z.string().min(1)).default([]),
  articulationId: z.string().min(1).optional(),
});

const DecisionCommitmentsSchema = z.object({
  contentCommitments: z.array(z.string().min(1)).min(1),
  formalCommitments: z.array(z.string().min(1)).min(1),
  invariants: z.array(z.string().min(1)).default([]),
  prohibitedShortcuts: z.array(z.string().min(1)).default([]),
  validationNote: z.string().min(1).optional(),
});

export const AcceptProposalBodySchema = DecisionCommitmentsSchema;

export const ModifyProposalBodySchema = DecisionCommitmentsSchema.superRefine(
  (body, context) => {
    if (!body.validationNote?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["validationNote"],
        message: "an adaptation requires an author note",
      });
    }
  }
);

export const RejectProposalBodySchema = z.object({
  note: z.string().min(1).optional(),
});

export const CreateWritingDraftUnitBodySchema = z.object({
  decisionId: z.string().min(1),
  targetWordCount: z.number().int().positive().optional(),
});

export const CreateChapterOperationBodySchema = z.object({
  chapterId: z.string().min(1),
});

export const ChapterOperationDetailBodySchema = z.object({
  detail: z.string().min(1).optional(),
});

export type EditorialWorkspaceBody = z.infer<typeof EditorialWorkspaceBodySchema>;
export type ReadSectionBody = z.infer<typeof ReadSectionBodySchema>;
export type DecisionCommitmentsBody = z.infer<typeof DecisionCommitmentsSchema>;
export type CreateWritingDraftUnitBody = z.infer<typeof CreateWritingDraftUnitBodySchema>;
export type CreateChapterOperationBody = z.infer<typeof CreateChapterOperationBodySchema>;
export type ChapterOperationDetailBody = z.infer<typeof ChapterOperationDetailBodySchema>;
