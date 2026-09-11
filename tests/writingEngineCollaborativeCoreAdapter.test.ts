import { describe, expect, it } from "vitest";
import {
  LiteraryManuscriptSchema,
  LiteraryScopeSchema,
} from "writing-engine";
import {
  DraftUnitSchema,
  ManuscriptSchema,
} from "../src/domain";
import {
  projectAutoEssayManuscriptToCollaborativeCore,
  toCollaborativeCoreScope,
} from "../src/editorial/writingEngineCollaborativeCoreAdapter";

const createdAt = "2026-09-11T18:00:00.000Z";
const updatedAt = "2026-09-11T19:00:00.000Z";

function paragraphUnit() {
  return DraftUnitSchema.parse({
    id: "unit-paragraph-1",
    projectId: "project-1",
    granularity: "paragraph",
    targetWordCount: 200,
    evidencePack: { sourceIds: ["source-1"] },
    content: "A paragraph grounded in the existing AutoEssay DraftUnit.",
    claimIds: ["claim-1"],
    citationUses: [],
    appliedDecisionIds: ["decision-1"],
    appliedArticulationIds: [],
    transformationTraceIds: ["trace-1"],
    status: "verified",
    version: 3,
    createdAt,
    updatedAt,
  });
}

function sectionUnit() {
  return DraftUnitSchema.parse({
    id: "unit-section-1",
    projectId: "project-1",
    granularity: "section",
    targetWordCount: 1200,
    evidencePack: { sourceIds: [] },
    content: "A standalone section stored as an AutoEssay DraftUnit.",
    claimIds: [],
    citationUses: [],
    appliedDecisionIds: [],
    appliedArticulationIds: [],
    transformationTraceIds: [],
    status: "drafting",
    version: 2,
    createdAt,
    updatedAt,
  });
}

function sourceManuscript() {
  return ManuscriptSchema.parse({
    id: "manuscript-1",
    projectId: "project-1",
    title: "Essay manuscript",
    tree: [
      {
        kind: "node",
        id: "chapter-1",
        title: "Chapter One",
        children: [
          {
            kind: "node",
            id: "section-1",
            title: "Section One",
            plan: [
              {
                id: "paragraph-1",
                subject: "Paragraph One",
                unitId: "unit-paragraph-1",
                unitVersion: 3,
                notes: [],
              },
            ],
            children: [
              {
                kind: "leaf",
                unitId: "unit-paragraph-1",
                version: 3,
              },
            ],
          },
        ],
      },
      {
        kind: "leaf",
        unitId: "unit-section-1",
        version: 2,
      },
    ],
    createdAt,
    updatedAt,
  });
}

describe("AutoEssay Collaborative Manuscript Core compatibility adapter", () => {
  it("projects the existing manuscript without changing AutoEssay ownership", () => {
    const source = sourceManuscript();
    const units = [paragraphUnit(), sectionUnit()];
    const sourceSnapshot = structuredClone(source);
    const unitsSnapshot = structuredClone(units);

    const projected = projectAutoEssayManuscriptToCollaborativeCore({
      manuscript: source,
      draftUnits: units,
      contentCreatedBy: { id: "autoessay-compat" },
    });

    expect(() => LiteraryManuscriptSchema.parse(projected.manuscript)).not.toThrow();
    expect(projected.manuscript.rootId).toBe("manuscript-1");
    expect(projected.manuscript.nodes["manuscript-1"]).toMatchObject({
      id: "manuscript-1",
      kind: "manuscript",
      title: "Essay manuscript",
      childIds: ["chapter-1", "unit-section-1"],
    });

    expect(projected.manuscript.nodes["chapter-1"]).toMatchObject({
      id: "chapter-1",
      kind: "chapter",
      parentId: "manuscript-1",
      childIds: ["section-1"],
    });
    expect(projected.manuscript.nodes["section-1"]).toMatchObject({
      id: "section-1",
      kind: "section",
      parentId: "chapter-1",
      childIds: ["paragraph-1"],
    });

    // A linked PlanEntry supplies the stable literary paragraph id; DraftUnit stays product-owned.
    expect(projected.manuscript.nodes["paragraph-1"]).toMatchObject({
      id: "paragraph-1",
      kind: "paragraph",
      parentId: "section-1",
      contentRef: { nodeId: "paragraph-1", version: 3 },
      domainRefs: expect.arrayContaining([
        { kind: "autoessay.draft-unit", id: "unit-paragraph-1" },
        { kind: "autoessay.claim", id: "claim-1" },
        { kind: "autoessay.editorial-decision", id: "decision-1" },
        { kind: "autoessay.transformation-trace", id: "trace-1" },
      ]),
    });

    // A standalone section DraftUnit remains addressable without becoming a shared DraftUnit type.
    expect(projected.manuscript.nodes["unit-section-1"]).toMatchObject({
      id: "unit-section-1",
      kind: "section",
      parentId: "manuscript-1",
      contentRef: { nodeId: "unit-section-1", version: 2 },
      domainRefs: [
        { kind: "autoessay.draft-unit", id: "unit-section-1" },
      ],
    });

    expect(projected.contentVersions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          nodeId: "paragraph-1",
          version: 3,
          content: units[0]!.content,
          createdBy: { id: "autoessay-compat" },
        }),
        expect.objectContaining({
          nodeId: "unit-section-1",
          version: 2,
          content: units[1]!.content,
          createdBy: { id: "autoessay-compat" },
        }),
      ])
    );

    expect(source).toEqual(sourceSnapshot);
    expect(units).toEqual(unitsSnapshot);
  });

  it("produces Core scopes for existing AutoEssay literary identities", () => {
    const paragraphScope = toCollaborativeCoreScope("paragraph-1", {
      start: 2,
      end: 12,
    });
    const sectionScope = toCollaborativeCoreScope("section-1");

    expect(LiteraryScopeSchema.parse(paragraphScope)).toEqual({
      nodeId: "paragraph-1",
      range: { start: 2, end: 12 },
    });
    expect(LiteraryScopeSchema.parse(sectionScope)).toEqual({
      nodeId: "section-1",
    });
  });

  it("fails instead of silently dropping a referenced DraftUnit version", () => {
    const source = sourceManuscript();

    expect(() =>
      projectAutoEssayManuscriptToCollaborativeCore({
        manuscript: source,
        draftUnits: [paragraphUnit()],
        contentCreatedBy: { id: "autoessay-compat" },
      })
    ).toThrow(/unit-section-1@2/);
  });
});
