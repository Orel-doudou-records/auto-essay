import { describe, expect, it } from "vitest";
import {
  DraftUnitSchema,
  ManuscriptSchema,
  type DraftUnit,
  type Manuscript,
} from "@auto-essay/core";
import { makeTempDataDir } from "./helper.js";
import { putWorkspace } from "../src/services/editorialWorkspaceStore.js";
import { getUnit, setUnits, updateUnit } from "../src/services/unitStore.js";
import { createFileCollaborativeCoreStore } from "../src/services/collaborativeCoreStore.js";
import {
  captureCollaborativeRevisionSource,
  createCollaborativeParagraphRevision,
  resolveRevisionAuthority,
} from "../src/services/collaborativeRevisionWork.js";
import {
  listCollaborativeRevisionWorks,
  loadCollaborativeRevisionWork,
} from "../src/services/collaborativeRevisionWorkStore.js";

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
            title: "Section",
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
        ],
      },
    ],
    createdAt,
    updatedAt: createdAt,
  });
  return { manuscript, unit };
}

async function seed(dataDir: string): Promise<{ manuscript: Manuscript; unit: DraftUnit }> {
  process.env.AUTO_ESSAY_DATA_DIR = dataDir;
  const source = fixture();
  await setUnits("project-1", [source.unit]);
  await putWorkspace("project-1", {
    manuscript: source.manuscript,
    distribution: [],
    profiles: [],
    articulations: [],
  });
  return source;
}

describe("AE2 collaborative revise-chat work", () => {
  it("resolves authority only for mounted paragraph candidates", () => {
    const paragraph = fixture().unit;
    const section = DraftUnitSchema.parse({ ...paragraph, id: "section-unit", granularity: "section" });

    expect(resolveRevisionAuthority({ unit: paragraph, literaryNodeId: "paragraph-1" })).toBe(
      "collaborative-core"
    );
    expect(resolveRevisionAuthority({ unit: paragraph })).toBe("legacy");
    expect(resolveRevisionAuthority({ unit: section, literaryNodeId: "section-1" })).toBe("legacy");
  });

  it("persists a generated paragraph candidate as a non-canonical CC1 workspace revision", async () => {
    const dataDir = makeTempDataDir();
    await seed(dataDir);
    const source = await captureCollaborativeRevisionSource("project-1", "unit-1");
    expect(source.authority).toBe("collaborative-core");
    if (source.authority !== "collaborative-core") throw new Error("expected collaborative source");

    const result = await createCollaborativeParagraphRevision({
      projectId: "project-1",
      source,
      proposedContent: "Revised paragraph candidate.",
    });

    expect(result.status).toBe("created");
    if (result.status !== "created") throw new Error("expected created work");
    const work = result.work;
    expect(work).toMatchObject({
      projectId: "project-1",
      unitId: "unit-1",
      literaryNodeId: "paragraph-1",
      proposedContent: "Revised paragraph candidate.",
      status: "working",
      base: {
        unitId: "unit-1",
        unitVersion: 3,
        content: "Canonical paragraph.",
      },
    });
    expect(work.headRevisionId).not.toBe(work.baseRevisionId);

    const store = createFileCollaborativeCoreStore("project-1", { dataDir });
    const link = await store.loadProjectLink();
    expect(link).toBeDefined();
    const graph = await store.loadRevisionGraph(link!.coreProjectId);
    expect(graph?.branches[work.workspaceId]).toMatchObject({
      id: work.workspaceId,
      kind: "workspace",
      canonical: false,
      headRevisionId: work.headRevisionId,
    });
    expect(graph?.branches[link!.canonicalBranchId]?.headRevisionId).toBe(work.baseRevisionId);
    expect(graph?.revisions[work.headRevisionId]).toMatchObject({
      branchId: work.workspaceId,
      parentIds: [work.baseRevisionId],
      author: { id: "autoessay:revision-agent" },
      provenanceRefs: expect.arrayContaining([
        { kind: "autoessay.revise-chat", id: work.id },
        { kind: "autoessay.draft-unit", id: "unit-1" },
      ]),
    });

    const workManuscript = await store.loadCurrentManuscript(link!.coreProjectId, work.workspaceId);
    const workNode = workManuscript?.nodes["paragraph-1"];
    expect(workNode?.contentRef?.version).toBe(4);
    const workContent = await store.resolveContentVersion(
      link!.coreProjectId,
      work.headRevisionId,
      "paragraph-1",
      workNode!.contentRef!.version
    );
    expect(workContent?.content).toBe("Revised paragraph candidate.");
    expect(await loadCollaborativeRevisionWork("project-1", work.id)).toEqual(work);

    const canonicalUnit = await getUnit("project-1", "unit-1");
    expect(canonicalUnit).toMatchObject({ content: "Canonical paragraph.", version: 3 });
  });

  it("returns candidate_stale_before_workspace with zero CC1 effects when the source changes during generation", async () => {
    const dataDir = makeTempDataDir();
    await seed(dataDir);
    const source = await captureCollaborativeRevisionSource("project-1", "unit-1");
    expect(source.authority).toBe("collaborative-core");
    if (source.authority !== "collaborative-core") throw new Error("expected collaborative source");

    await updateUnit("project-1", "unit-1", {
      content: "Autosaved while the model was generating.",
    });

    const result = await createCollaborativeParagraphRevision({
      projectId: "project-1",
      source,
      proposedContent: "Candidate based on stale text.",
    });

    expect(result).toEqual({ status: "candidate_stale_before_workspace" });
    const store = createFileCollaborativeCoreStore("project-1", { dataDir });
    expect(await store.loadProjectLink()).toBeUndefined();
    expect(await listCollaborativeRevisionWorks("project-1")).toEqual([]);
  });

  it("uses one final-candidate completion seam and creates no partial streaming state", async () => {
    const dataDir = makeTempDataDir();
    await seed(dataDir);
    const source = await captureCollaborativeRevisionSource("project-1", "unit-1");
    expect(source.authority).toBe("collaborative-core");
    if (source.authority !== "collaborative-core") throw new Error("expected collaborative source");

    const store = createFileCollaborativeCoreStore("project-1", { dataDir });
    const chunks = ["Revised ", "streamed ", "paragraph."];
    let finalCandidate = "";
    for (const chunk of chunks) {
      finalCandidate += chunk;
      expect(await store.loadProjectLink()).toBeUndefined();
      expect(await listCollaborativeRevisionWorks("project-1")).toEqual([]);
    }

    const result = await createCollaborativeParagraphRevision({
      projectId: "project-1",
      source,
      proposedContent: finalCandidate,
    });

    expect(result.status).toBe("created");
    expect((await listCollaborativeRevisionWorks("project-1")).length).toBe(1);
    if (result.status !== "created") throw new Error("expected created work");
    expect(result.work.proposedContent).toBe("Revised streamed paragraph.");
  });
});
