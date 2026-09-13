import { describe, expect, it } from "vitest";
import { createClaim } from "../src/domain/claim";
import type { Citation } from "../src/domain/citation";
import { createSource } from "../src/domain/source";
import { RelationAnalyzer } from "../src/editorial/relationAnalyzer";

class MockStructuredClient {
  constructor(private readonly output: unknown) {}
  async generateJson(): Promise<unknown> {
    return this.output;
  }
}

function createFixture() {
  const archive = createSource({
    projectId: "project-1",
    title: "Archive",
    content: "Le lieu est enregistré comme disparu.",
    type: "pdf",
    regime: "institutional_archive",
  });
  const testimony = createSource({
    projectId: "project-1",
    title: "Témoignage",
    content: "Le lieu continue d'être nommé et pratiqué.",
    type: "pdf",
    regime: "testimony",
  });

  const archiveClaim = createClaim({
    projectId: "project-1",
    statement: "Le lieu a disparu selon le registre.",
    confidenceLevel: "probable",
    claimType: "fact",
    sourceIds: [archive.id],
  });
  const testimonyClaim = createClaim({
    projectId: "project-1",
    statement: "Le lieu persiste dans les pratiques décrites.",
    confidenceLevel: "probable",
    claimType: "counterclaim",
    sourceIds: [testimony.id],
    contradictionOf: archiveClaim.id,
  });

  const verifiedCitation: Citation = {
    id: "citation-verified",
    projectId: "project-1",
    sourceId: archive.id,
    quote: "Le lieu est enregistré comme disparu.",
    locator: { kind: "page", value: "4" },
    verificationStatus: "verified",
    createdAt: "2026-09-13T12:00:00.000Z",
  };
  const unverifiedCitation: Citation = {
    ...verifiedCitation,
    id: "citation-unverified",
    verificationStatus: "unverified",
  };

  return {
    archive,
    testimony,
    archiveClaim,
    testimonyClaim,
    verifiedCitation,
    unverifiedCitation,
  };
}

describe("RelationAnalyzer", () => {
  it("detects source-level support and contradiction without pretending sources are citations", async () => {
    const fixture = createFixture();
    const analyzer = new RelationAnalyzer();

    const relations = await analyzer.analyze({
      scope: {
        level: "section",
        projectId: "project-1",
        sectionId: "section-1",
      },
      sources: [fixture.archive, fixture.testimony],
      claims: [fixture.archiveClaim, fixture.testimonyClaim],
    });

    expect(relations.filter((relation) => relation.type === "supports")).toHaveLength(2);
    expect(relations.some((relation) => relation.type === "contradicts")).toBe(true);
    expect(relations.every((relation) => relation.citationIds.length === 0)).toBe(true);
  });

  it("accepts verified citation ids on a model relation", async () => {
    const fixture = createFixture();
    const client = new MockStructuredClient({
      relations: [
        {
          type: "differs_in_scope",
          participants: [
            { kind: "source", id: fixture.archive.id },
            { kind: "source", id: fixture.testimony.id },
          ],
          description:
            "L'archive décrit un statut administratif tandis que le témoignage décrit une pratique vécue.",
          citationIds: [fixture.verifiedCitation.id],
          confidence: "high",
        },
      ],
    });
    const analyzer = new RelationAnalyzer(client);

    const relations = await analyzer.analyze({
      scope: {
        level: "section",
        projectId: "project-1",
        sectionId: "section-1",
      },
      sources: [fixture.archive, fixture.testimony],
      claims: [fixture.archiveClaim, fixture.testimonyClaim],
      citations: [fixture.verifiedCitation],
    });

    const relation = relations.find((item) => item.type === "differs_in_scope");
    expect(relation?.citationIds).toEqual([fixture.verifiedCitation.id]);
  });

  it("rejects a non-verified citation proposed as argumentative grounding", async () => {
    const fixture = createFixture();
    const client = new MockStructuredClient({
      relations: [
        {
          type: "qualifies",
          participants: [
            { kind: "claim", id: fixture.archiveClaim.id },
            { kind: "claim", id: fixture.testimonyClaim.id },
          ],
          description: "The testimony qualifies the archive claim.",
          citationIds: [fixture.unverifiedCitation.id],
          confidence: "medium",
        },
      ],
    });
    const analyzer = new RelationAnalyzer(client);

    await expect(
      analyzer.analyze({
        scope: {
          level: "section",
          projectId: "project-1",
          sectionId: "section-1",
        },
        sources: [fixture.archive, fixture.testimony],
        claims: [fixture.archiveClaim, fixture.testimonyClaim],
        citations: [fixture.unverifiedCitation],
      })
    ).rejects.toThrow("non-verified citation citation-unverified");
  });

  it("rejects participants invented by the model", async () => {
    const fixture = createFixture();
    const client = new MockStructuredClient({
      relations: [
        {
          type: "qualifies",
          participants: [
            { kind: "claim", id: fixture.archiveClaim.id },
            { kind: "claim", id: "unknown-claim" },
          ],
          description: "Relation inventée",
          citationIds: [],
          confidence: "low",
        },
      ],
    });
    const analyzer = new RelationAnalyzer(client);

    await expect(
      analyzer.analyze({
        scope: {
          level: "section",
          projectId: "project-1",
          sectionId: "section-1",
        },
        sources: [fixture.archive, fixture.testimony],
        claims: [fixture.archiveClaim, fixture.testimonyClaim],
      })
    ).rejects.toThrow("unknown claim unknown-claim");
  });

  it("deduplicates model relations already found deterministically", async () => {
    const fixture = createFixture();
    const client = new MockStructuredClient({
      relations: [
        {
          type: "supports",
          participants: [
            { kind: "source", id: fixture.archive.id },
            { kind: "claim", id: fixture.archiveClaim.id },
          ],
          description: "Duplicate support relation",
          citationIds: [fixture.verifiedCitation.id],
          confidence: "high",
        },
      ],
    });
    const analyzer = new RelationAnalyzer(client);

    const relations = await analyzer.analyze({
      scope: {
        level: "section",
        projectId: "project-1",
        sectionId: "section-1",
      },
      sources: [fixture.archive, fixture.testimony],
      claims: [fixture.archiveClaim, fixture.testimonyClaim],
      citations: [fixture.verifiedCitation],
    });

    const archiveSupport = relations.filter(
      (relation) =>
        relation.type === "supports" &&
        relation.participants.some(
          (participant) => participant.id === fixture.archiveClaim.id
        )
    );
    expect(archiveSupport).toHaveLength(1);
  });
});
