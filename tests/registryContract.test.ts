import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { createDraftUnit, type DraftUnit } from "../src/domain/draftUnit";
import type { DeliveryManifest } from "../src/domain/revision";
import { FileRegistry } from "../src/state/registry";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  );
});

async function registryFixture(editorialPlanId?: string) {
  const directory = await mkdtemp(join(tmpdir(), "auto-essay-registry-contract-"));
  temporaryDirectories.push(directory);

  const unit = createDraftUnit({
    projectId: "project-contract",
    granularity: "paragraph",
    content: "Le contenu de la première version demeure disponible.",
    editorialPlanId,
    appliedDecisionIds: editorialPlanId ? ["decision-1"] : [],
    appliedArticulationIds: editorialPlanId ? ["articulation-1"] : [],
    transformationTraceIds: editorialPlanId ? ["trace-1"] : [],
  });

  return {
    registry: new FileRegistry(directory),
    unit,
  };
}

function manifestFor(
  unit: DraftUnit,
  editorialPlanId?: string
): DeliveryManifest {
  return {
    version: unit.version,
    publishedAt: new Date().toISOString(),
    units: [{ unitId: unit.id, version: unit.version, score: 8 }],
    sourcesUsed: ["source-1"],
    verifiedClaims: ["claim-1"],
    remainingDebts: [],
    exports: {},
    editorialProvenance: editorialPlanId
      ? {
          planId: editorialPlanId,
          decisions: [{ decisionId: "decision-1", version: 1 }],
          articulationIds: ["articulation-1"],
          projectionIds: {
            writer: "projection-writer-1",
            evaluator: "projection-evaluator-1",
            revision: "projection-revision-1",
          },
          projectionHashes: {
            writer: "hash-writer",
            evaluator: "hash-evaluator",
            revision: "hash-revision",
          },
          transformationTraceIds: ["trace-1"],
        }
      : undefined,
  };
}

describe("contrat de FileRegistry", () => {
  it("retrouve la version publiée et prépare un rollback v2 en conservant le contenu v1", async () => {
    const { registry, unit } = await registryFixture();

    await registry.publishVersion(unit.projectId, unit, manifestFor(unit));

    const latest = await registry.getLatest(unit.projectId, unit.id);
    const rollback = await registry.rollback(unit.projectId, unit.id, 1);

    expect(latest).toMatchObject({ id: unit.id, version: 1, content: unit.content });
    expect(rollback).toMatchObject({
      id: unit.id,
      version: 2,
      status: "drafting",
      content: unit.content,
    });
  });

  it("rejette une provenance dont le plan diffère de celui de l’unité", async () => {
    const { registry, unit } = await registryFixture("plan-1");

    await expect(
      registry.publishVersion(unit.projectId, unit, manifestFor(unit, "plan-2"))
    ).rejects.toThrow("Editorial manifest plan does not match the published unit");
  });

  it("publie un manifeste historique sans provenance éditoriale", async () => {
    const { registry, unit } = await registryFixture();

    const entry = await registry.publishVersion(
      unit.projectId,
      unit,
      manifestFor(unit)
    );

    expect(entry.manifest.editorialProvenance).toBeUndefined();
  });
});
