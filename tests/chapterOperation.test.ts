import {
  createChapterOperation,
  transitionChapterOperation,
} from "../src/index";

const now = "2026-08-27T11:00:00.000Z";

describe("chapter operations", () => {
  it("requires explicit author acts to start and resume a traceable chapter operation", () => {
    const created = createChapterOperation({
      projectId: "project-1",
      chapterId: "chapter-1",
      requestedBy: "author",
      createdAt: now,
    });
    const waiting = transitionChapterOperation(created, {
      type: "await_author_approval",
      actor: "system",
      occurredAt: now,
    });

    expect(waiting).toMatchObject({
      state: "awaiting_author",
      provenance: { projectId: "project-1", chapterId: "chapter-1", requestedBy: "author" },
      trace: [
        { type: "created", actor: "author" },
        { type: "await_author_approval", actor: "system" },
      ],
    });
    expect(() =>
      transitionChapterOperation(waiting, {
        type: "start",
        actor: "system",
        occurredAt: now,
      })
    ).toThrow("requires an author act");

    const running = transitionChapterOperation(waiting, {
      type: "start",
      actor: "author",
      occurredAt: now,
    });
    const paused = transitionChapterOperation(running, {
      type: "pause",
      actor: "system",
      occurredAt: now,
      detail: "Attente d’une vérification située.",
    });
    const resumed = transitionChapterOperation(paused, {
      type: "resume",
      actor: "author",
      occurredAt: now,
    });

    expect(resumed.state).toBe("running");
    expect(resumed.trace.at(-1)).toMatchObject({ type: "resume", actor: "author" });
  });

  it("supports a dedicated cancellation while preserving the operation trace", () => {
    const created = createChapterOperation({
      projectId: "project-1",
      chapterId: "chapter-1",
      requestedBy: "author",
      createdAt: now,
    });
    const cancelled = transitionChapterOperation(created, {
      type: "cancel",
      actor: "author",
      occurredAt: now,
      detail: "L’auteur suspend ce parcours.",
    });

    expect(cancelled).toMatchObject({
      state: "cancelled",
      trace: expect.arrayContaining([
        expect.objectContaining({ type: "cancel", actor: "author", detail: "L’auteur suspend ce parcours." }),
      ]),
    });
    expect(() =>
      transitionChapterOperation(cancelled, {
        type: "resume",
        actor: "author",
        occurredAt: now,
      })
    ).toThrow("cannot transition");
  });
});
