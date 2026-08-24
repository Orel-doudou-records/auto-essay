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

const BookPartsSchema = z.array(
  z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    status: z.enum([
      "drafting",
      "reviewing",
      "revising",
      "verified",
      "published",
      "archived",
    ]),
    text: z.string(),
  })
);

const ExistingCutsSchema = z.array(
  z.object({
    scope: z.string().min(1),
    verdict: z.string().min(1),
    cut: z.string().min(1),
  })
);

const BookPlanSchema = z.array(
  z.object({
    partId: z.string().min(1),
    partTitle: z.string().min(1),
    entries: z
      .array(
        z.object({
          id: z.string().min(1),
          subject: z.string().min(1),
          preview: z.string().optional(),
          notes: z
            .array(
              z.object({
                kind: z.enum(["human", "agent"]),
                text: z.string().min(1),
              })
            )
            .optional(),
        })
      )
      .min(1),
  })
);

export const DiffractBodySchema = z.object({
  statement: z.string().min(1),
  claimIds: z.array(z.string().min(1)).optional(),
  sourceIds: z.array(z.string().min(1)).optional(),
  book: z.string().optional(),
  bookParts: BookPartsSchema.optional(),
  bookPlan: BookPlanSchema.optional(),
  existingCuts: ExistingCutsSchema.optional(),
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
  bookParts: BookPartsSchema.optional(),
  bookPlan: BookPlanSchema.optional(),
  existingCuts: ExistingCutsSchema.optional(),
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
      bookParts: BookPartsSchema.optional(),
      bookPlan: BookPlanSchema.optional(),
  bookPlan: BookPlanSchema.optional(),
      existingCuts: ExistingCutsSchema.optional(),
      concepts: ConceptsSchema.optional(),
      tensions: TensionsSchema.optional(),
    })
    .optional(),
});
