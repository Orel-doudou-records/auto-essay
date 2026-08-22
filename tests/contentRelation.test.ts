import { describe, expect, it } from "vitest";
import {
  ContentRelationSchema,
  EditorialScopeSchema,
  assignRelationRoles,
  createContentRelation,
} from "../src/domain/contentRelation";

describe("ContentRelation", () => {
  it("should represent a contradiction without merging participants", () => {
    const relation = createContentRelation({
      scope: {
        level: "section",
        projectId: "project-1",
        sectionId: "section-1",
      },
      type: "contradicts",
      participants: [
        { kind: "source", id: "archive-1", role: "institutional chronology" },
        { kind: "source", id: "testimony-1", role: "situated chronology" },
      ],
      description: "The testimony dates the closure before the archive records it.",
      evidenceIds: ["annotation-1", "annotation-2"],
      origin: "co_constructed",
    });

    expect(relation.type).toBe("contradicts");
    expect(relation.participants).toHaveLength(2);
    expect(relation.status).toBe("detected");
    expect(relation.confidence).toBe("medium");
  });

  it("should distinguish a difference in scope from a contradiction", () => {
    const relation = createContentRelation({
      scope: { level: "project", projectId: "project-1" },
      type: "differs_in_scope",
      participants: [
        { kind: "claim", id: "claim-local" },
        { kind: "claim", id: "claim-national" },
      ],
      description: "One claim concerns a venue; the other concerns a national field.",
      origin: "system_detected",
    });

    expect(relation.type).toBe("differs_in_scope");
    expect(relation.type).not.toBe("contradicts");
  });

  it("should reject a binary relation with only one participant", () => {
    expect(() =>
      ContentRelationSchema.parse({
        id: "relation-1",
        scope: { level: "project", projectId: "project-1" },
        type: "supports",
        participants: [{ kind: "claim", id: "claim-1" }],
        description: "Incomplete support relation",
        origin: "system_detected",
        createdAt: new Date().toISOString(),
      })
    ).toThrow();
  });

  it("should allow a documented silence to use one focal participant", () => {
    const relation = createContentRelation({
      scope: {
        level: "paragraph",
        projectId: "project-1",
        sectionId: "section-1",
        paragraphId: "paragraph-2",
      },
      type: "silences",
      participants: [
        {
          kind: "source",
          id: "archive-1",
          role: "source whose omission is being described",
        },
      ],
      description: "The archive does not record the workers' oral accounts.",
      origin: "author_declared",
    });

    expect(relation.participants).toHaveLength(1);
  });

  it("should enforce identifiers required by the editorial scope", () => {
    expect(() =>
      EditorialScopeSchema.parse({
        level: "section",
        projectId: "project-1",
      })
    ).toThrow();

    expect(() =>
      EditorialScopeSchema.parse({
        level: "project",
        projectId: "project-1",
        sectionId: "section-1",
      })
    ).toThrow();
  });
});

describe("ContentRelation atomicity", () => {
  it("rejects a typed relation with three participants", () => {
    expect(() =>
      ContentRelationSchema.parse({
        id: "relation-1",
        scope: { level: "project", projectId: "project-1" },
        type: "supports",
        participants: [
          { kind: "claim", id: "claim-1" },
          { kind: "claim", id: "claim-2" },
          { kind: "source", id: "source-1" },
        ],
        description: "Three participants are not atomic",
        origin: "system_detected",
        createdAt: new Date().toISOString(),
      })
    ).toThrow();
  });

  it("rejects a silence relation with two participants", () => {
    expect(() =>
      ContentRelationSchema.parse({
        id: "relation-1",
        scope: { level: "project", projectId: "project-1" },
        type: "silences",
        participants: [
          { kind: "source", id: "source-1" },
          { kind: "source", id: "source-2" },
        ],
        description: "A silence is unary",
        origin: "author_declared",
        createdAt: new Date().toISOString(),
      })
    ).toThrow();
  });

  it("assigns canonical roles by type when roles are missing", () => {
    const roles = assignRelationRoles("supports", [
      { kind: "claim", id: "claim-1" },
      { kind: "claim", id: "claim-2" },
    ]);

    expect(roles.map((participant) => participant.role)).toEqual([
      "supporting",
      "supported",
    ]);
  });

  it("preserves an explicit role while filling the other", () => {
    const roles = assignRelationRoles("contradicts", [
      { kind: "claim", id: "claim-1", role: "archive view" },
      { kind: "claim", id: "claim-2" },
    ]);

    expect(roles[0].role).toBe("archive view");
    expect(roles[1].role).toBe("challenged");
  });

  it("accepts a groupId for reified n-ary relations", () => {
    const relation = createContentRelation({
      scope: { level: "project", projectId: "project-1" },
      type: "contradicts",
      participants: [
        { kind: "claim", id: "claim-1" },
        { kind: "claim", id: "claim-2" },
      ],
      description: "Part of a joint contradiction",
      origin: "system_detected",
      groupId: "argument-1",
    });

    expect(relation.groupId).toBe("argument-1");
  });
});
