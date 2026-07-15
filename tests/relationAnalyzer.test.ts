import { describe, expect, it } from "vitest";
import { createClaim } from "../src/domain/claim";
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

  return { archive, testimony, archiveClaim, testimonyClaim };
}

describe("RelationAnalyzer", () => {
  it("detects explicit support and contradiction without an LLM", async () => {
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
    expect(
      relations.some((relation) => relation.type === "contradicts")
    ).toBe(true);
    expect(relations.every((relation) => relation.origin === "system_detected")).toBe(true);
  });

  it("adds a model relation while preserving deterministic relations", async () => {
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
          evidenceIds: [fixture.archive.id, fixture.testimony.id],
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
    });

    expect(
      relations.some((relation) => relation.type === "differs_in_scope")
    ).toBe(true);
    expect(
      relations.some((relation) => relation.type === "contradicts")
    ).toBe(true);
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
          evidenceIds: [],
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
          evidenceIds: [fixture.archive.id],
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
