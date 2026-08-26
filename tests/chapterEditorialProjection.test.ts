import {
  createDraftUnit,
  createSource,
  EditorialDecisionSchema,
  ManuscriptSchema,
  projectChapterEditorialState,
  type SourceProfile,
} from "../src/index";

const now = "2026-08-27T10:00:00.000Z";

function createFixture() {
  const manuscript = ManuscriptSchema.parse({
    id: "manuscript-1",
    projectId: "project-1",
    title: "Manuscrit P2",
    createdAt: now,
    updatedAt: now,
    tree: [
      {
        kind: "node",
        id: "chapter-1",
        title: "Chapitre premier",
        children: [
          {
            kind: "node",
            id: "section-1",
            title: "Première section",
            children: [{ kind: "leaf", unitId: "unit-mounted", version: 1 }],
          },
          {
            kind: "node",
            id: "section-2",
            title: "Seconde section",
            children: [],
          },
        ],
      },
    ],
  });
  const units = [
    createDraftUnit({
      projectId: "project-1",
      granularity: "paragraph",
      status: "verified",
      content: "Contenu monté.",
      version: 1,
      contextInPlan: { section: "section-1" },
      evidencePack: { sourceIds: [] },
      id: "unit-mounted",
    }),
    createDraftUnit({
      projectId: "project-1",
      granularity: "paragraph",
      status: "drafting",
      content: "",
      contextInPlan: { section: "section-1" },
      evidencePack: { sourceIds: ["source-qualified"] },
      appliedDecisionIds: ["decision-section-1"],
      appliedArticulationIds: ["articulation-section-1"],
      id: "unit-prepared",
    }),
  ];
  const decision = (id: string, sectionId: string, status: "active" | "revoked" | "superseded") =>
    EditorialDecisionSchema.parse({
      id,
      projectId: "project-1",
      version: 1,
      scope: { projectId: "project-1", level: "section", sectionId },
      articulationId: `articulation-${sectionId}`,
      contentCommitments: [`Engagement ${sectionId}`],
      formalCommitments: ["Maintenir la forme située"],
      validation: { validatedBy: "author", validatedAt: now },
      status,
      createdAt: now,
      updatedAt: now,
    });
  const sources = [
    createSource({
      id: "source-qualified",
      projectId: "project-1",
      title: "Archive qualifiée",
      content: "Extrait qualifié de la première section.",
    }),
    createSource({
      id: "source-unqualified",
      projectId: "project-1",
      title: "Piste sans extrait",
      content: "",
    }),
  ];
  const profiles: SourceProfile[] = [
    {
      sourceId: "source-qualified",
      subjects: ["mémoire"],
      concepts: ["archive"],
      abstract: "Archive reliée à la section.",
    },
    {
      sourceId: "source-unqualified",
      subjects: ["mémoire"],
      concepts: [],
    },
  ];

  return {
    manuscript,
    units,
    decisions: [
      decision("decision-section-1", "section-1", "active"),
      decision("decision-revoked", "section-1", "revoked"),
      decision("decision-superseded", "section-1", "superseded"),
      decision("decision-section-2", "section-2", "active"),
    ],
    sources,
    profiles,
    distribution: [
      { sourceId: "source-qualified", scopeId: "section-1", rationale: "archive distribuée", confidence: 0.9 },
      { sourceId: "source-unqualified", scopeId: "section-1", rationale: "piste distribuée", confidence: 0.5 },
    ],
  };
}

describe("projectChapterEditorialState", () => {
  it("projects ordered sections with active decisions, visible evidence, and prepared units only", () => {
    const fixture = createFixture();

    const chapter = projectChapterEditorialState({
      ...fixture,
      chapterId: "chapter-1",
    });

    expect(chapter).toMatchObject({
      chapter: { id: "chapter-1", title: "Chapitre premier", writingStatus: "drafting" },
      sections: [
        {
          id: "section-1",
          order: 1,
          writingStatus: "verified",
          decisions: [{ id: "decision-section-1", provenance: { scope: "section-1" } }],
          units: [
            {
              id: "unit-mounted",
              preparedForWriting: false,
              provenance: { association: "manuscript_leaf" },
            },
            {
              id: "unit-prepared",
              preparedForWriting: true,
              provenance: { association: "section_context" },
            },
          ],
          sources: [
            { sourceId: "source-qualified", qualified: true, availability: "evidence_pack" },
            {
              sourceId: "source-unqualified",
              qualified: false,
              availability: "visible_only",
              exclusionReason: "missing_excerpt",
            },
          ],
        },
        {
          id: "section-2",
          order: 2,
          writingStatus: "drafting",
          decisions: [{ id: "decision-section-2" }],
          units: [],
          sources: [],
        },
      ],
    });
    expect(chapter.sections[0]?.decisions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "decision-revoked" }),
        expect.objectContaining({ id: "decision-superseded" }),
      ])
    );
  });

  it("rejects a missing chapter without performing a side effect", () => {
    const fixture = createFixture();

    expect(() =>
      projectChapterEditorialState({ ...fixture, chapterId: "missing-chapter" })
    ).toThrow("chapter not found");
  });
});
