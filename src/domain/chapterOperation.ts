import { z } from "zod";

export const ChapterOperationStateSchema = z.enum([
  "preparing",
  "awaiting_author",
  "running",
  "paused",
  "failed",
  "cancelled",
  "completed",
]);
export type ChapterOperationState = z.infer<typeof ChapterOperationStateSchema>;

export const ChapterOperationActorSchema = z.enum(["author", "system"]);
export type ChapterOperationActor = z.infer<typeof ChapterOperationActorSchema>;

export const ChapterOperationEventTypeSchema = z.enum([
  "created",
  "await_author_approval",
  "start",
  "pause",
  "resume",
  "fail",
  "cancel",
  "complete",
]);
export type ChapterOperationEventType = z.infer<typeof ChapterOperationEventTypeSchema>;

export const ChapterOperationEventSchema = z.object({
  type: ChapterOperationEventTypeSchema,
  actor: ChapterOperationActorSchema,
  occurredAt: z.string().datetime(),
  detail: z.string().min(1).optional(),
});
export type ChapterOperationEvent = z.infer<typeof ChapterOperationEventSchema>;

export const ChapterOperationSchema = z.object({
  id: z.string().min(1),
  state: ChapterOperationStateSchema,
  provenance: z.object({
    projectId: z.string().min(1),
    chapterId: z.string().min(1),
    requestedBy: z.literal("author"),
  }),
  trace: z.array(ChapterOperationEventSchema).min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ChapterOperation = z.infer<typeof ChapterOperationSchema>;

export type CreateChapterOperationInput = {
  projectId: string;
  chapterId: string;
  requestedBy: "author";
  createdAt?: string;
};

export type ChapterOperationTransition = Omit<ChapterOperationEvent, "type"> & {
  type: Exclude<ChapterOperationEventType, "created">;
};

/**
 * Déclare une opération future de chapitre. Cette création n’exécute aucun
 * travail, ne contacte aucun modèle et laisse l’opération en préparation.
 */
export function createChapterOperation(
  input: CreateChapterOperationInput
): ChapterOperation {
  const createdAt = input.createdAt ?? new Date().toISOString();
  return ChapterOperationSchema.parse({
    id: crypto.randomUUID(),
    state: "preparing",
    provenance: {
      projectId: input.projectId,
      chapterId: input.chapterId,
      requestedBy: input.requestedBy,
    },
    trace: [{ type: "created", actor: input.requestedBy, occurredAt: createdAt }],
    createdAt,
    updatedAt: createdAt,
  });
}

/**
 * Applique une transition déclarative sans lancer l’opération. Les actes qui
 * pourraient faire avancer un travail (démarrage ou reprise) restent réservés
 * à l’auteur afin d’éviter tout raccourci d’automatisation.
 */
export function transitionChapterOperation(
  operation: ChapterOperation,
  transition: ChapterOperationTransition
): ChapterOperation {
  const event = ChapterOperationEventSchema.parse(transition);
  const nextState = resolveNextState(operation.state, event);

  return ChapterOperationSchema.parse({
    ...operation,
    state: nextState,
    trace: [...operation.trace, event],
    updatedAt: event.occurredAt,
  });
}

function resolveNextState(
  current: ChapterOperationState,
  event: ChapterOperationEvent
): ChapterOperationState {
  if ((event.type === "start" || event.type === "resume") && event.actor !== "author") {
    throw new Error(`${event.type} requires an author act`);
  }
  if (event.type === "cancel" && event.actor !== "author") {
    throw new Error("cancel requires an author act");
  }

  const transitions: Record<ChapterOperationState, Partial<Record<ChapterOperationEventType, ChapterOperationState>>> = {
    preparing: {
      await_author_approval: "awaiting_author",
      cancel: "cancelled",
      fail: "failed",
    },
    awaiting_author: {
      start: "running",
      cancel: "cancelled",
      fail: "failed",
    },
    running: {
      pause: "paused",
      complete: "completed",
      cancel: "cancelled",
      fail: "failed",
    },
    paused: {
      resume: "running",
      cancel: "cancelled",
      fail: "failed",
    },
    failed: {
      resume: "preparing",
      cancel: "cancelled",
    },
    cancelled: {},
    completed: {},
  };
  const next = transitions[current][event.type];
  if (!next) {
    throw new Error(`cannot transition chapter operation from ${current} with ${event.type}`);
  }
  return next;
}
