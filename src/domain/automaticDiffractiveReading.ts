import { z } from "zod";
import { DraftUnitStatusSchema } from "./draftUnit";
import { DiffractiveReadingSchema, type DiffractiveReading } from "./diffractiveReading";

export const DiffractiveReadingModeSchema = z.enum(["strict", "automatic"]);
export type DiffractiveReadingMode = z.infer<typeof DiffractiveReadingModeSchema>;

export const AutomaticDiffractiveReadingStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "superseded",
]);
export type AutomaticDiffractiveReadingStatus = z.infer<
  typeof AutomaticDiffractiveReadingStatusSchema
>;

export const AutomaticDiffractiveReadingTriggerSchema = z.enum([
  "activation",
  "text_changed",
  "plan_changed",
  "decision_changed",
  "sources_changed",
]);
export type AutomaticDiffractiveReadingTrigger = z.infer<
  typeof AutomaticDiffractiveReadingTriggerSchema
>;

const BookPartSnapshotSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  status: DraftUnitStatusSchema,
  text: z.string(),
});

const BookPlanSnapshotSchema = z.object({
  partId: z.string().min(1),
  partTitle: z.string().min(1),
  entries: z.array(
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
      unitId: z.string().min(1).optional(),
      unitVersion: z.number().int().min(1).optional(),
    })
  ),
});

const ExistingCutSnapshotSchema = z.object({
  scope: z.string().min(1),
  verdict: z.string().min(1),
  cut: z.string().min(1),
});

const BibliographySnapshotSchema = z.object({
  entries: z.array(
    z.object({
      sourceId: z.string().min(1),
      title: z.string().optional(),
      authors: z.array(z.string()).optional(),
      subjects: z.array(z.string()).optional(),
      concepts: z.array(z.string()).optional(),
    })
  ),
});

/**
 * Instantané suffisant pour qu’un worker lise l’état demandé sans reconstruire
 * un contexte qui aurait pu évoluer entre l’activation et le traitement.
 */
export const AutomaticDiffractiveReadingInputSchema = z.object({
  fingerprint: z.string().min(1),
  statement: z.string().min(1),
  claimIds: z.array(z.string().min(1)).default([]),
  sourceIds: z.array(z.string().min(1)).default([]),
  bookParts: z.array(BookPartSnapshotSchema).default([]),
  bookPlan: z.array(BookPlanSnapshotSchema).default([]),
  existingCuts: z.array(ExistingCutSnapshotSchema).default([]),
  bookBibliography: BibliographySnapshotSchema,
});
export type AutomaticDiffractiveReadingInput = z.infer<
  typeof AutomaticDiffractiveReadingInputSchema
>;

/**
 * Demande durable produite par l’activation auteur du mode automatique.
 * Elle ne porte que la lecture à effectuer et son résultat : aucune décision
 * ou instruction de réécriture ne peut y être représentée.
 */
export const AutomaticDiffractiveReadingSchema = z
  .object({
    id: z.string().min(1),
    projectId: z.string().min(1),
    sectionId: z.string().min(1),
    requestedBy: z.literal("author"),
    trigger: AutomaticDiffractiveReadingTriggerSchema,
    status: AutomaticDiffractiveReadingStatusSchema,
    input: AutomaticDiffractiveReadingInputSchema,
    reading: DiffractiveReadingSchema.optional(),
    failure: z.string().min(1).optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .superRefine((request, context) => {
    if (request.status === "completed" && !request.reading) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reading"],
        message: "a completed automatic reading requires a reading",
      });
    }
    if (request.status === "failed" && !request.failure) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["failure"],
        message: "a failed automatic reading requires a failure",
      });
    }
    if (request.reading && request.status !== "completed") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reading"],
        message: "an automatic reading is only stored after completion",
      });
    }
  });
export type AutomaticDiffractiveReading = z.infer<
  typeof AutomaticDiffractiveReadingSchema
>;

export function createAutomaticDiffractiveReading(input: {
  projectId: string;
  sectionId: string;
  readingInput: AutomaticDiffractiveReadingInput;
  trigger: AutomaticDiffractiveReadingTrigger;
  createdAt?: string;
}): AutomaticDiffractiveReading {
  const createdAt = input.createdAt ?? new Date().toISOString();
  return AutomaticDiffractiveReadingSchema.parse({
    id: crypto.randomUUID(),
    projectId: input.projectId,
    sectionId: input.sectionId,
    requestedBy: "author",
    trigger: input.trigger,
    status: "pending",
    input: input.readingInput,
    createdAt,
    updatedAt: createdAt,
  });
}

export function startAutomaticDiffractiveReading(
  request: AutomaticDiffractiveReading,
  occurredAt = new Date().toISOString()
): AutomaticDiffractiveReading {
  if (request.status !== "pending" && request.status !== "running") {
    throw new Error(`cannot start automatic reading from ${request.status}`);
  }
  return AutomaticDiffractiveReadingSchema.parse({
    ...request,
    status: "running",
    updatedAt: occurredAt,
  });
}

export function completeAutomaticDiffractiveReading(
  request: AutomaticDiffractiveReading,
  reading: DiffractiveReading,
  occurredAt = new Date().toISOString()
): AutomaticDiffractiveReading {
  if (request.status !== "running") {
    throw new Error(`cannot complete automatic reading from ${request.status}`);
  }
  return AutomaticDiffractiveReadingSchema.parse({
    ...request,
    status: "completed",
    reading,
    updatedAt: occurredAt,
  });
}

export function supersedeAutomaticDiffractiveReading(
  request: AutomaticDiffractiveReading,
  occurredAt = new Date().toISOString()
): AutomaticDiffractiveReading {
  if (request.status !== "pending") {
    throw new Error(`cannot supersede automatic reading from ${request.status}`);
  }
  return AutomaticDiffractiveReadingSchema.parse({
    ...request,
    status: "superseded",
    updatedAt: occurredAt,
  });
}

export function failAutomaticDiffractiveReading(
  request: AutomaticDiffractiveReading,
  failure: string,
  occurredAt = new Date().toISOString()
): AutomaticDiffractiveReading {
  if (request.status !== "pending" && request.status !== "running") {
    throw new Error(`cannot fail automatic reading from ${request.status}`);
  }
  return AutomaticDiffractiveReadingSchema.parse({
    ...request,
    status: "failed",
    failure,
    updatedAt: occurredAt,
  });
}
