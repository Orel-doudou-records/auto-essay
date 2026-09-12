import { describe, expect, it } from "vitest";
import {
  DraftUnitSchema,
  ManuscriptSchema,
  type DraftUnit,
  type Manuscript,
} from "@auto-essay/core";
import { makeTempDataDir } from "./helper.js";
import { getWorkspace, putWorkspace } from "../src/services/editorialWorkspaceStore.js";
import { getUnit, setUnits } from "../src/services/unitStore.js";
import { createFileCollaborativeCoreStore } from "../src/services/collaborativeCoreStore.js";
import {
  acceptCollaborativeParagraphRevision,
  captureCollaborativeRevisionSource,
  createCollaborativeParagraphRevision,
} from "../src/services/collaborativeRevisionWork.js";
import {
  IntegrationMaterializationRecoveryError,
  integrateCollaborativeParagraphRevision,
  recoverIncompleteIntegrationMaterializations,
  type IntegrationMaterializationFaultPoint,
} from "../src/services/collaborativeRevisionIntegration.js";

const projectId = "project-recovery";
const unitId = "unit-recovery";
const createdAt = "2026-09-12T09:00:00.000Z";

function fixture(): { manuscript: Manuscript; unit: DraftUnit } {
  const unit = DraftUnitSchema.parse({
    id: unitId,
    projectId,
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
    version: 7,
    createdAt,
    updatedAt: createdAt,
  });
  const manuscript = ManuscriptSchema.parse({
    id: "manuscript-recovery",
    projectId,
    title: "Recovery essay",
    tree: [
      {
        kind: "node",
        id: "chapter-recovery",
        title: "Chapter",
        children: [
          {
            kind: "node",
            id: "section-recovery",
            title: "Section",
            plan: [
              {
                id: "paragraph-recovery",
                subject: "Paragraph",
                unitId,
                unitVersion: 7,
                notes: [],
              },
            ],
            children: [{ kind: "leaf", unitId, version: 7 }],
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
  await setUnits(projectId, [source.unit]);
  await putWorkspace(projectId, {
    manuscript: source.manuscript,
    distribution: [],
    profiles: [],
    articulations: [],
  });
}

async function createWork(proposedContent = "Recovered integration content.") {
  const source = await captureCollaborativeRevisionSource(projectId, unitId);
  expect(source.authority).toBe("collaborative-core");
  if (source.authority !== "collaborative-core") throw new Error("expected collaborative source");
  const created = await createCollaborativeParagraphRevision({
    projectId,
    source,
    proposedContent,
  });
  expect(created.status).toBe("created");
  if (created.status !== "created") throw new Error("expected created work");
  return created.work;
}

async function acceptWork(workId: string, content = "Recovered integration content.") {
  return acceptCollaborativeParagraphRevision({
    projectId,
    unitId,
    workId,
    content,
  });
}

function crashAt(point: IntegrationMaterializationFaultPoint) {
  return async (current: IntegrationMaterializationFaultPoint) => {
    if (current === point) throw new Error(`simulated crash: ${point}`);
  };
}

function manuscriptVersion(manuscript: Manuscript): number {
  const chapter = manuscript.tree[0];
  if (chapter?.kind !== "node") throw new Error("chapter fixture missing");
  const section = chapter.children[0];
  if (section?.kind !== "node") throw new Error("section fixture missing");
  const leaf = section.children[0];
  if (leaf?.kind !== "leaf") throw new Error("leaf fixture missing");
  expect(section.plan?.[0]?.unitVersion).toBe(leaf.version);
  return leaf.version;
}

async function acceptedFixture(dataDir: string) {
  await seed(dataDir);
  const work = await createWork();
  const accepted = await acceptWork(work.id);
  return accepted;
}

describe("AE2 Integration materialization recovery", () => {
  it("resumes a prepared receipt after restart without creating a duplicate Integration", async () => {
    const dataDir = makeTempDataDir();
    const accepted = await acceptedFixture(dataDir);

    await expect(
      integrateCollaborativeParagraphRevision({
        projectId,
        unitId,
        workId: accepted.work.id,
        faultInjection: crashAt("after_prepared_receipt"),
      })
    ).rejects.toThrow("simulated crash: after_prepared_receipt");

    const crashedStore = createFileCollaborativeCoreStore(projectId, { dataDir });
    const [prepared] = await crashedStore.listMaterializationReceipts();
    expect(prepared?.status).toBe("prepared");
    const link = await crashedStore.loadProjectLink();
    expect(await crashedStore.loadIntegration(link!.coreProjectId, prepared!.integrationId)).toBeUndefined();

    const result = await integrateCollaborativeParagraphRevision({
      projectId,
      unitId,
      workId: accepted.work.id,
    });

    expect(result.status).toBe("integrated");
    if (result.status !== "integrated") throw new Error("expected recovered integration");
    expect(result.integration.id).toBe(prepared!.integrationId);
    expect(result.receipt.id).toBe(prepared!.id);
    expect(result.receipt.status).toBe("applied");
    expect(result.unit.version).toBe(8);
    expect(manuscriptVersion((await getWorkspace(projectId)).manuscript)).toBe(8);
    expect((await crashedStore.listMaterializationReceipts())).toHaveLength(1);
  });

  it("recovers when the CC1 Integration is durable but the receipt was not advanced", async () => {
    const dataDir = makeTempDataDir();
    const accepted = await acceptedFixture(dataDir);

    await expect(
      integrateCollaborativeParagraphRevision({
        projectId,
        unitId,
        workId: accepted.work.id,
        faultInjection: crashAt("after_core_integration"),
      })
    ).rejects.toThrow("simulated crash: after_core_integration");

    const restartedStore = createFileCollaborativeCoreStore(projectId, { dataDir });
    const [receipt] = await restartedStore.listMaterializationReceipts();
    const link = await restartedStore.loadProjectLink();
    expect(receipt?.status).toBe("prepared");
    expect(await restartedStore.loadIntegration(link!.coreProjectId, receipt!.integrationId)).toBeDefined();

    const recovered = await recoverIncompleteIntegrationMaterializations(projectId);
    expect(recovered).toHaveLength(1);
    expect(recovered[0]?.status).toBe("applied");
    expect((await getUnit(projectId, unitId))?.version).toBe(8);
    expect(manuscriptVersion((await getWorkspace(projectId)).manuscript)).toBe(8);
  });

  it("finishes only the missing manuscript side after a DraftUnit write crash", async () => {
    const dataDir = makeTempDataDir();
    const accepted = await acceptedFixture(dataDir);

    await expect(
      integrateCollaborativeParagraphRevision({
        projectId,
        unitId,
        workId: accepted.work.id,
        faultInjection: crashAt("after_draft_unit_write"),
      })
    ).rejects.toThrow("simulated crash: after_draft_unit_write");

    expect((await getUnit(projectId, unitId))?.version).toBe(8);
    expect(manuscriptVersion((await getWorkspace(projectId)).manuscript)).toBe(7);

    await recoverIncompleteIntegrationMaterializations(projectId);

    expect((await getUnit(projectId, unitId))?.version).toBe(8);
    expect(manuscriptVersion((await getWorkspace(projectId)).manuscript)).toBe(8);
    const store = createFileCollaborativeCoreStore(projectId, { dataDir });
    expect((await store.listMaterializationReceipts())[0]?.status).toBe("applied");
  });

  it("recognizes an already-materialized target after projection update and never creates vN+2", async () => {
    const dataDir = makeTempDataDir();
    const accepted = await acceptedFixture(dataDir);

    await expect(
      integrateCollaborativeParagraphRevision({
        projectId,
        unitId,
        workId: accepted.work.id,
        faultInjection: crashAt("after_projection_link"),
      })
    ).rejects.toThrow("simulated crash: after_projection_link");

    expect((await getUnit(projectId, unitId))?.version).toBe(8);
    expect(manuscriptVersion((await getWorkspace(projectId)).manuscript)).toBe(8);

    const retried = await integrateCollaborativeParagraphRevision({
      projectId,
      unitId,
      workId: accepted.work.id,
    });
    expect(retried.status).toBe("integrated");
    if (retried.status !== "integrated") throw new Error("expected idempotent integration");
    expect(retried.unit.version).toBe(8);
    expect((await getUnit(projectId, unitId))?.version).toBe(8);
    expect(manuscriptVersion((await getWorkspace(projectId)).manuscript)).toBe(8);
  });

  it("blocks recovery on unexpected canonical divergence without overwriting it", async () => {
    const dataDir = makeTempDataDir();
    const accepted = await acceptedFixture(dataDir);

    await expect(
      integrateCollaborativeParagraphRevision({
        projectId,
        unitId,
        workId: accepted.work.id,
        faultInjection: crashAt("after_core_integrated_receipt"),
      })
    ).rejects.toThrow("simulated crash: after_core_integrated_receipt");

    const current = await getUnit(projectId, unitId);
    await setUnits(projectId, [
      DraftUnitSchema.parse({
        ...current!,
        content: "Unexpected third state.",
        version: 9,
        updatedAt: "2026-09-12T10:00:00.000Z",
      }),
    ]);

    await expect(recoverIncompleteIntegrationMaterializations(projectId)).rejects.toMatchObject({
      name: "IntegrationMaterializationRecoveryError",
      code: "canonical_diverged",
    } satisfies Partial<IntegrationMaterializationRecoveryError>);
    expect(await getUnit(projectId, unitId)).toMatchObject({
      content: "Unexpected third state.",
      version: 9,
    });
    expect(manuscriptVersion((await getWorkspace(projectId)).manuscript)).toBe(7);
  });

  it("makes repeated accept and Integration commands converge on the same Proposal and materialization", async () => {
    const dataDir = makeTempDataDir();
    await seed(dataDir);
    const work = await createWork();

    const firstAccept = await acceptWork(work.id);
    const secondAccept = await acceptWork(work.id);
    expect(secondAccept.proposal.id).toBe(firstAccept.proposal.id);
    expect(secondAccept.authorRevisionCreated).toBe(false);

    const firstIntegration = await integrateCollaborativeParagraphRevision({
      projectId,
      unitId,
      workId: work.id,
    });
    const secondIntegration = await integrateCollaborativeParagraphRevision({
      projectId,
      unitId,
      workId: work.id,
    });
    expect(firstIntegration.status).toBe("integrated");
    expect(secondIntegration.status).toBe("integrated");
    if (firstIntegration.status !== "integrated" || secondIntegration.status !== "integrated") {
      throw new Error("expected idempotent integrations");
    }
    expect(secondIntegration.integration.id).toBe(firstIntegration.integration.id);
    expect(secondIntegration.receipt.id).toBe(firstIntegration.receipt.id);
    expect((await getUnit(projectId, unitId))?.version).toBe(8);
    expect(manuscriptVersion((await getWorkspace(projectId)).manuscript)).toBe(8);
  });

  it("runs recovery before creating later AE2 work", async () => {
    const dataDir = makeTempDataDir();
    const accepted = await acceptedFixture(dataDir);

    await expect(
      integrateCollaborativeParagraphRevision({
        projectId,
        unitId,
        workId: accepted.work.id,
        faultInjection: crashAt("after_core_integrated_receipt"),
      })
    ).rejects.toThrow();

    const staleSource = await captureCollaborativeRevisionSource(projectId, unitId);
    expect(staleSource.authority).toBe("collaborative-core");
    if (staleSource.authority !== "collaborative-core") throw new Error("expected collaborative source");

    const next = await createCollaborativeParagraphRevision({
      projectId,
      source: staleSource,
      proposedContent: "A later candidate.",
    });

    expect(next.status).toBe("candidate_stale_before_workspace");
    expect((await getUnit(projectId, unitId))?.version).toBe(8);
    const store = createFileCollaborativeCoreStore(projectId, { dataDir });
    expect((await store.listMaterializationReceipts())[0]?.status).toBe("applied");
  });
});
