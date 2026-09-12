import { describe, expect, it } from "vitest";
import {
  DraftUnitSchema,
  ManuscriptSchema,
  advanceManuscriptUnitVersion,
  type DraftUnit,
  type Manuscript,
} from "@auto-essay/core";
import { makeTempDataDir } from "./helper.js";
import {
  getWorkspace,
  putWorkspace,
} from "../src/services/editorialWorkspaceStore.js";
import { getUnit, setUnits } from "../src/services/unitStore.js";
import { createFileCollaborativeCoreStore } from "../src/services/collaborativeCoreStore.js";
import {
  acceptCollaborativeParagraphRevision,
  captureCollaborativeRevisionSource,
  createCollaborativeParagraphRevision,
} from "../src/services/collaborativeRevisionWork.js";
import { loadCollaborativeRevisionWork } from "../src/services/collaborativeRevisionWorkStore.js";
import { integrateCollaborativeParagraphRevision } from "../src/services/collaborativeRevisionIntegration.js";

const createdAt = "2026-09-12T08:00:00.000Z";

function fixture(): { manuscript: Manuscript; unit: DraftUnit } {
  const unit = DraftUnitSchema.parse({
    id: "unit-1",
    projectId: "project-1",
    granularity: "paragraph",
    targetWordCount: 180,
    evidencePack: { sourceIds: [] },
    content: "Canonical paragraph.",
    claimIds: [],
    citationUses: [],
    appliedDecisionIds: [],
    appliedArticulationIds: [],
    transformationTraceIds: [],
    status: "drafting",
    version: 3,
    createdAt,
    updatedAt: createdAt,
  });
  const manuscript = ManuscriptSchema.parse({
    id: "manuscript-1",
    projectId: "project-1",
    title: "Essay",
    tree: [
      {
        kind: "node",
        id: "chapter-1",
        title: "Chapter",
        children: [
          {
            kind: "node",
            id: "section-1",
            title: "Section One",
            plan: [
              {
                id: "paragraph-1",
                subject: "Paragraph",
                unitId: "unit-1",
                unitVersion: 3,
                notes: [],
              },
            ],
            children: [{ kind: "leaf", unitId: "unit-1", version: 3 }],
          },
          {
            kind: "node",
            id: "section-2",
            title: "Section Two",
            plan: [],
            children: [],
          },
        ],
      },
    ],
    createdAt,
    updatedAt: createdAt,
  });
  return { manuscript, unit };
}

async function seed(dataDir: string): Promise<void> {
  process.env.AUTO_ESSAY_DATA_DIR = dataDir;
  const source = fixture();
  await setUnits("project-1", [source.unit]);
  await putWorkspace("project-1", {
    manuscript: source.manuscript,
    distribution: [],
    profiles: [],
    articulations: [],
  });
}

async function createAcceptedWork(proposedContent = "Integrated paragraph.") {
  const source = await captureCollaborativeRevisionSource("project-1", "unit-1");
  expect(source.authority).toBe("collaborative-core");
  if (source.authority !== "collaborative-core") throw new Error("expected collaborative source");
  const created = await createCollaborativeParagraphRevision({
    projectId: "project-1",
    source,
    proposedContent,
  });
  expect(created.status).toBe("created");
  if (created.status !== "created") throw new Error("expected created work");
  const accepted = await acceptCollaborativeParagraphRevision({
    projectId: "project-1",
    unitId: "unit-1",
    workId: created.work.id,
    content: proposedContent,
  });
  return accepted;
}

function versionRefs(manuscript: Manuscript): { leaf: number; plan: number } {
  const chapter = manuscript.tree[0];
  if (chapter?.kind !== "node") throw new Error("chapter fixture missing");
  const section = chapter.children[0];
  if (section?.kind !== "node") throw new Error("section fixture missing");
  const leaf = section.children[0];
  if (leaf?.kind !== "leaf") throw new Error("leaf fixture missing");
  return { leaf: leaf.version, plan: section.plan![0]!.unitVersion! };
}

describe("AE2 conflict-aware Integration materialization", () => {
  it("integrates an accepted Proposal and materializes exactly one AutoEssay version", async () => {
    const dataDir = makeTempDataDir();
    await seed(dataDir);
    const accepted = await createAcceptedWork();

    const result = await integrateCollaborativeParagraphRevision({
      projectId: "project-1",
      unitId: "unit-1",
      workId: accepted.work.id,
    });

    expect(result.status).toBe("integrated");
    if (result.status !== "integrated") throw new Error("expected integration");
    expect(result.unit).toMatchObject({
      id: "unit-1",
      content: "Integrated paragraph.",
      version: 4,
    });
    expect(versionRefs((await getWorkspace("project-1")).manuscript)).toEqual({
      leaf: 4,
      plan: 4,
    });
    expect(result.receipt.status).toBe("applied");
    expect(result.work).toMatchObject({
      status: "integrated",
      proposalId: accepted.proposal.id,
      integrationId: result.integration.id,
    });

    const store = createFileCollaborativeCoreStore("project-1", { dataDir });
    const link = await store.loadProjectLink();
    const integration = await store.loadIntegration(
      link!.coreProjectId,
      result.integration.id
    );
    expect(integration).toEqual(result.integration);
    const receipt = await store.loadMaterializationReceipt(result.receipt.id);
    expect(receipt).toEqual(result.receipt);
    const projection = await store.loadProjectionLink(accepted.work.literaryNodeId);
    expect(projection).toMatchObject({
      coreRevisionId: result.integration.revisionId,
      autoEssay: { unitId: "unit-1", unitVersion: 4 },
    });
    expect(await getUnit("project-1", "unit-1")).toMatchObject({ version: 4 });
  });

  it("synchronizes external same-paragraph drift and blocks stale/textual integration", async () => {
    const dataDir = makeTempDataDir();
    await seed(dataDir);
    const accepted = await createAcceptedWork();
    const current = await getUnit("project-1", "unit-1");
    await setUnits("project-1", [
      DraftUnitSchema.parse({
        ...current!,
        content: "External canonical edit.",
        updatedAt: "2026-09-12T09:00:00.000Z",
      }),
    ]);

    const result = await integrateCollaborativeParagraphRevision({
      projectId: "project-1",
      unitId: "unit-1",
      workId: accepted.work.id,
    });

    expect(result.status).toBe("blocked");
    if (result.status !== "blocked") throw new Error("expected conflict block");
    expect(result.assessment.stale).toBe(true);
    expect(result.assessment.conflicts.map((conflict) => conflict.kind)).toContain("textual");
    expect((await getUnit("project-1", "unit-1"))?.content).toBe("External canonical edit.");
    expect((await loadCollaborativeRevisionWork("project-1", accepted.work.id))?.status).toBe("stale");
  });

  it("blocks a structural move of the same literary paragraph", async () => {
    const dataDir = makeTempDataDir();
    await seed(dataDir);
    const accepted = await createAcceptedWork();
    const workspace = await getWorkspace("project-1");
    const chapter = workspace.manuscript.tree[0];
    if (chapter?.kind !== "node") throw new Error("chapter fixture missing");
    const [first, second] = chapter.children;
    if (first?.kind !== "node" || second?.kind !== "node") {
      throw new Error("section fixtures missing");
    }
    const movedLeaf = first.children[0]!;
    const movedPlan = first.plan![0]!;
    const movedManuscript = ManuscriptSchema.parse({
      ...workspace.manuscript,
      updatedAt: "2026-09-12T09:10:00.000Z",
      tree: [
        {
          ...chapter,
          children: [
            { ...first, plan: [], children: [] },
            { ...second, plan: [movedPlan], children: [movedLeaf] },
          ],
        },
      ],
    });
    await putWorkspace("project-1", {
      manuscript: movedManuscript,
      distribution: workspace.distribution,
      profiles: workspace.profiles,
      articulations: workspace.articulations,
    });

    const result = await integrateCollaborativeParagraphRevision({
      projectId: "project-1",
      unitId: "unit-1",
      workId: accepted.work.id,
    });

    expect(result.status).toBe("blocked");
    if (result.status !== "blocked") throw new Error("expected conflict block");
    expect(result.assessment.conflicts.map((conflict) => conflict.kind)).toContain("structural");
    expect((await getUnit("project-1", "unit-1"))?.version).toBe(3);
  });

  it("blocks explicit AutoEssay editorial conflict declarations without inferring them", async () => {
    const dataDir = makeTempDataDir();
    await seed(dataDir);
    const accepted = await createAcceptedWork();

    const result = await integrateCollaborativeParagraphRevision({
      projectId: "project-1",
      unitId: "unit-1",
      workId: accepted.work.id,
      editorialConflicts: [
        {
          id: "argument-conflict-1",
          reason: "AutoEssay detected an explicit argumentative contradiction.",
          declaredBy: { kind: "autoessay.editorial-conflict", id: "argument-conflict-1" },
        },
      ],
    });

    expect(result.status).toBe("blocked");
    if (result.status !== "blocked") throw new Error("expected editorial block");
    expect(result.assessment.conflicts.map((conflict) => conflict.kind)).toContain("editorial");
    expect((await getUnit("project-1", "unit-1"))?.version).toBe(3);
  });
});

describe("advanceManuscriptUnitVersion", () => {
  it("advances the mounted leaf and its linked plan entry coherently", () => {
    const { manuscript } = fixture();
    const advanced = advanceManuscriptUnitVersion(manuscript, "unit-1", 3, 4);
    expect(versionRefs(advanced)).toEqual({ leaf: 4, plan: 4 });
    expect(versionRefs(manuscript)).toEqual({ leaf: 3, plan: 3 });
  });

  it("fails on ambiguous references instead of partially advancing the manuscript", () => {
    const { manuscript } = fixture();
    const chapter = manuscript.tree[0];
    if (chapter?.kind !== "node") throw new Error("chapter fixture missing");
    const second = chapter.children[1];
    if (second?.kind !== "node") throw new Error("section fixture missing");
    const ambiguous = ManuscriptSchema.parse({
      ...manuscript,
      tree: [
        {
          ...chapter,
          children: [
            chapter.children[0]!,
            {
              ...second,
              children: [{ kind: "leaf", unitId: "unit-1", version: 2 }],
            },
          ],
        },
      ],
    });

    expect(() =>
      advanceManuscriptUnitVersion(ambiguous, "unit-1", 3, 4)
    ).toThrow("ambiguous manuscript references");
    expect(versionRefs(manuscript)).toEqual({ leaf: 3, plan: 3 });
  });
});
