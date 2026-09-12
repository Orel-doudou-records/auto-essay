import { describe, expect, it } from "vitest";
import {
  DraftUnitSchema,
  ManuscriptSchema,
  type DraftUnit,
  type Manuscript,
} from "@auto-essay/core";
import { makeTempDataDir } from "./helper.js";
import {
  bootstrapAutoEssayCollaborativeCore,
  createFileCollaborativeCoreStore,
} from "../src/services/collaborativeCoreStore.js";
import { synchronizeAutoEssayCanonicalWhileLocked } from "../src/services/collaborativeCoreCanonicalSync.js";

const createdAt = "2026-09-12T00:00:00.000Z";
const changedAt = "2026-09-12T00:05:00.000Z";

function fixture(): { manuscript: Manuscript; units: DraftUnit[] } {
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
            title: "Section 1",
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
            title: "Section 2",
            plan: [],
            children: [],
          },
        ],
      },
    ],
    createdAt,
    updatedAt: createdAt,
  });
  return { manuscript, units: [unit] };
}

function bumpReferences(manuscript: Manuscript, version: number): Manuscript {
  const next = structuredClone(manuscript);
  const chapter = next.tree[0];
  if (chapter?.kind !== "node") throw new Error("chapter fixture missing");
  const section = chapter.children[0];
  if (section?.kind !== "node") throw new Error("section fixture missing");
  const plan = section.plan?.[0];
  const leaf = section.children[0];
  if (plan === undefined || leaf?.kind !== "leaf") throw new Error("paragraph fixture missing");
  plan.unitVersion = version;
  leaf.version = version;
  next.updatedAt = changedAt;
  return ManuscriptSchema.parse(next);
}

function moveParagraph(manuscript: Manuscript): Manuscript {
  const next = structuredClone(manuscript);
  const chapter = next.tree[0];
  if (chapter?.kind !== "node") throw new Error("chapter fixture missing");
  const first = chapter.children[0];
  const second = chapter.children[1];
  if (first?.kind !== "node" || second?.kind !== "node") throw new Error("section fixture missing");
  const plan = first.plan?.[0];
  const leaf = first.children[0];
  if (plan === undefined || leaf?.kind !== "leaf") throw new Error("paragraph fixture missing");
  first.plan = [];
  first.children = [];
  second.plan = [plan];
  second.children = [leaf];
  next.updatedAt = changedAt;
  return ManuscriptSchema.parse(next);
}

function removeParagraph(manuscript: Manuscript): Manuscript {
  const next = structuredClone(manuscript);
  const chapter = next.tree[0];
  if (chapter?.kind !== "node") throw new Error("chapter fixture missing");
  const second = chapter.children[1];
  if (second?.kind !== "node") throw new Error("section fixture missing");
  second.plan = [];
  second.children = [];
  next.updatedAt = changedAt;
  return ManuscriptSchema.parse(next);
}

describe("AE2 canonical synchronization", () => {
  it("detects same AutoEssay version with a different hash and advances the independent CC1 clock", async () => {
    const dataDir = makeTempDataDir();
    const source = fixture();
    const store = createFileCollaborativeCoreStore("project-1", { dataDir });
    const bootstrap = await bootstrapAutoEssayCollaborativeCore({
      autoEssayProjectId: "project-1",
      manuscript: source.manuscript,
      draftUnits: source.units,
      store,
    });
    const beforeHead = bootstrap.graph.branches[bootstrap.graph.canonicalBranchId]!.headRevisionId;
    const previousLink = bootstrap.projectionLinks[0]!;
    const driftedUnit = DraftUnitSchema.parse({
      ...source.units[0]!,
      content: "Autosaved without bumping DraftUnit.version.",
      updatedAt: changedAt,
    });

    const result = await synchronizeAutoEssayCanonicalWhileLocked({
      autoEssayProjectId: "project-1",
      manuscript: source.manuscript,
      draftUnits: [driftedUnit],
      store,
    });

    expect(result).toMatchObject({
      status: "synchronized",
      revisionCreated: true,
      changeKinds: ["replace_content"],
    });
    if (result.status !== "synchronized") throw new Error("expected synchronization");
    expect(result.coreRevisionId).not.toBe(beforeHead);
    const graph = await store.loadRevisionGraph(bootstrap.projectLink.coreProjectId);
    expect(graph?.revisions[result.coreRevisionId]?.provenanceRefs).toContainEqual({
      kind: "autoessay.canonical-sync",
      id: "project-1",
    });
    const current = await store.loadCurrentManuscript(
      bootstrap.projectLink.coreProjectId,
      bootstrap.projectLink.canonicalBranchId
    );
    expect(current?.nodes["paragraph-1"]?.contentRef).toEqual({
      nodeId: "paragraph-1",
      version: 4,
    });
    const content = await store.resolveContentVersion(
      bootstrap.projectLink.coreProjectId,
      result.coreRevisionId,
      "paragraph-1",
      4
    );
    expect(content?.content).toBe("Autosaved without bumping DraftUnit.version.");
    const link = await store.loadProjectionLink("paragraph-1");
    expect(link?.autoEssay.unitVersion).toBe(3);
    expect(link?.autoEssay.contentHash).not.toBe(previousLink.autoEssay.contentHash);
    expect(link?.coreContentVersion.version).toBe(4);
    expect(link?.coreRevisionId).toBe(result.coreRevisionId);

    const repeated = await synchronizeAutoEssayCanonicalWhileLocked({
      autoEssayProjectId: "project-1",
      manuscript: source.manuscript,
      draftUnits: [driftedUnit],
      store,
    });
    expect(repeated).toMatchObject({ status: "noop", coreRevisionId: result.coreRevisionId });
  });

  it("updates an AutoEssay version-only fingerprint without inventing a CC1 content revision", async () => {
    const dataDir = makeTempDataDir();
    const source = fixture();
    const store = createFileCollaborativeCoreStore("project-1", { dataDir });
    const bootstrap = await bootstrapAutoEssayCollaborativeCore({
      autoEssayProjectId: "project-1",
      manuscript: source.manuscript,
      draftUnits: source.units,
      store,
    });
    const head = bootstrap.graph.branches[bootstrap.graph.canonicalBranchId]!.headRevisionId;
    const versionFour = DraftUnitSchema.parse({
      ...source.units[0]!,
      version: 4,
      updatedAt: changedAt,
    });

    const result = await synchronizeAutoEssayCanonicalWhileLocked({
      autoEssayProjectId: "project-1",
      manuscript: bumpReferences(source.manuscript, 4),
      draftUnits: [versionFour],
      store,
    });

    expect(result).toMatchObject({
      status: "synchronized",
      revisionCreated: false,
      coreRevisionId: head,
      changeKinds: [],
    });
    const link = await store.loadProjectionLink("paragraph-1");
    expect(link?.autoEssay.unitVersion).toBe(4);
    expect(link?.coreContentVersion).toEqual({ nodeId: "paragraph-1", version: 3 });
  });

  it("projects deterministic move then removal drift as semantic CC1 changes", async () => {
    const dataDir = makeTempDataDir();
    const source = fixture();
    const store = createFileCollaborativeCoreStore("project-1", { dataDir });
    const bootstrap = await bootstrapAutoEssayCollaborativeCore({
      autoEssayProjectId: "project-1",
      manuscript: source.manuscript,
      draftUnits: source.units,
      store,
    });

    const moved = await synchronizeAutoEssayCanonicalWhileLocked({
      autoEssayProjectId: "project-1",
      manuscript: moveParagraph(source.manuscript),
      draftUnits: source.units,
      store,
    });
    expect(moved).toMatchObject({
      status: "synchronized",
      revisionCreated: true,
      changeKinds: ["move_node"],
    });
    let current = await store.loadCurrentManuscript(
      bootstrap.projectLink.coreProjectId,
      bootstrap.projectLink.canonicalBranchId
    );
    expect(current?.nodes["paragraph-1"]?.parentId).toBe("section-2");

    const removed = await synchronizeAutoEssayCanonicalWhileLocked({
      autoEssayProjectId: "project-1",
      manuscript: removeParagraph(moveParagraph(source.manuscript)),
      draftUnits: source.units,
      store,
    });
    expect(removed).toMatchObject({
      status: "synchronized",
      revisionCreated: true,
      changeKinds: ["remove_node"],
    });
    current = await store.loadCurrentManuscript(
      bootstrap.projectLink.coreProjectId,
      bootstrap.projectLink.canonicalBranchId
    );
    expect(current?.nodes["paragraph-1"]?.removed).toBe(true);
  });

  it("rejects new or reintroduced literary identities as unsupported projection drift", async () => {
    const dataDir = makeTempDataDir();
    const source = fixture();
    const store = createFileCollaborativeCoreStore("project-1", { dataDir });
    const bootstrap = await bootstrapAutoEssayCollaborativeCore({
      autoEssayProjectId: "project-1",
      manuscript: source.manuscript,
      draftUnits: source.units,
      store,
    });
    const beforeHead = bootstrap.graph.branches[bootstrap.graph.canonicalBranchId]!.headRevisionId;
    const nextManuscript = structuredClone(source.manuscript);
    const chapter = nextManuscript.tree[0];
    if (chapter?.kind !== "node") throw new Error("chapter fixture missing");
    const section = chapter.children[0];
    if (section?.kind !== "node") throw new Error("section fixture missing");
    section.plan = [
      ...(section.plan ?? []),
      {
        id: "paragraph-2",
        subject: "New identity",
        unitId: "unit-2",
        unitVersion: 1,
        notes: [],
      },
    ];
    section.children.push({ kind: "leaf", unitId: "unit-2", version: 1 });
    const secondUnit = DraftUnitSchema.parse({
      ...source.units[0]!,
      id: "unit-2",
      version: 1,
      content: "A newly introduced paragraph.",
    });

    const result = await synchronizeAutoEssayCanonicalWhileLocked({
      autoEssayProjectId: "project-1",
      manuscript: ManuscriptSchema.parse(nextManuscript),
      draftUnits: [...source.units, secondUnit],
      store,
    });

    expect(result).toMatchObject({ status: "unsupported_projection_drift" });
    const graph = await store.loadRevisionGraph(bootstrap.projectLink.coreProjectId);
    expect(graph?.branches[graph.canonicalBranchId]!.headRevisionId).toBe(beforeHead);
  });
});
