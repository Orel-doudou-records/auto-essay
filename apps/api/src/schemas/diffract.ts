import { z } from "zod";
import { ContentStyleArticulationSchema } from "@auto-essay/core";

const ConceptsSchema = z.array(
  z.object({
    label: z.string().min(1),
    definition: z.string(),
  })
);

const TensionsSchema = z.array(
  z.object({
    label: z.string().min(1),
    description: z.string(),
  })
);

export const DiffractBodySchema = z.object({
  statement: z.string().min(1),
  claimIds: z.array(z.string().min(1)).optional(),
  sourceIds: z.array(z.string().min(1)).optional(),
  book: z.string().optional(),
  concepts: ConceptsSchema.optional(),
  tensions: TensionsSchema.optional(),
});

export const DiffractBatchBodySchema = z.object({
  fragments: z
    .array(
      z.object({
        statement: z.string().min(1),
        claimIds: z.array(z.string().min(1)).optional(),
        sourceIds: z.array(z.string().min(1)).optional(),
      })
    )
    .min(1),
  book: z.string().optional(),
  concepts: ConceptsSchema.optional(),
  tensions: TensionsSchema.optional(),
});

export const DiffractivePipelineBodySchema = z.object({
  fragment: z.object({
    statement: z.string().min(1),
    claimIds: z.array(z.string().min(1)).optional(),
    sourceIds: z.array(z.string().min(1)).optional(),
  }),
  articulation: ContentStyleArticulationSchema,
  commitments: z.object({
    contentCommitments: z.array(z.string().min(1)).min(1),
    formalCommitments: z.array(z.string().min(1)).min(1),
    invariants: z.array(z.string().min(1)).optional(),
    prohibitedShortcuts: z.array(z.string().min(1)).optional(),
    validationNote: z.string().min(1).optional(),
  }),
  context: z
    .object({
      book: z.string().optional(),
      concepts: ConceptsSchema.optional(),
      tensions: TensionsSchema.optional(),
    })
    .optional(),
});
