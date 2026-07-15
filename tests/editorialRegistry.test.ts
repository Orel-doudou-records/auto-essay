import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { createDraftUnit } from "../src/domain/draftUnit";
import type { DeliveryManifest } from "../src/domain/revision";
import { FileRegistry } from "../src/state/registry";
import { computeDeterministicHash } from "../src/state/editorialManifest";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  );
});

async function registryFixture() {
  const directory = await mkdtemp(join(tmpdir(), "auto-essay-registry-"));
  temporaryDirectories.push(directory);
  const unit = createDraftUnit({
    projectId: "project-1",
    granularity: "paragraph",
    content: "Chaque source conserve sa propre chronologie.",
    editorialPlanId: "plan-1",
    appliedDecisionIds: ["decision-1"],
    appliedArticulationIds: ["articulation-1"],
    transformationTraceIds: ["trace-1"],
  });

  return {
    registry: new FileRegistry(directory),
    unit,
  };
}

function manifestFor(
  unitId: string,
  unitVersion: number,
  withEditorialProvenance: boolean = true
): DeliveryManifest {
  return {
    version: unitVersion,
    publishedAt: new Date().toISOString(),
    units: [{ unitId, version: unitVersion, score: 8 }],
    sourcesUsed: ["source-1"],
    verifiedClaims: ["claim-1"],
    remainingDebts: [],
    exports: {},
    editorialProvenance: withEditorialProvenance
      ? {
          planId: "plan-1",
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
          editorialEffectEvaluationId: "editorial-eval-1",
          revisionBriefId: "brief-1",
        }
      : undefined,
  };
}

describe("FileRegistry editorial provenance", () => {
  it("publishes a version whose provenance matches the DraftUnit", async () => {
    const { registry, unit } = await registryFixture();
    const entry = await registry.publishVersion(
      unit.projectId,
      unit,
      manifestFor(unit.id, unit.version)
    );

    expect(entry.manifest.editorialProvenance?.planId).toBe("plan-1");
    expect(entry.manifest.editorialProvenance?.decisions).toEqual([
      { decisionId: "decision-1", version: 1 },
    ]);
  });

  it("keeps legacy manifests compatible", async () => {
    const { registry, unit } = await registryFixture();
    const entry = await registry.publishVersion(
      unit.projectId,
      unit,
      manifestFor(unit.id, unit.version, false)
    );

    expect(entry.manifest.editorialProvenance).toBeUndefined();
  });

  it("rejects provenance that does not match the published unit", async () => {
    const { registry, unit } = await registryFixture();
    const manifest = manifestFor(unit.id, unit.version);
    manifest.editorialProvenance!.decisions = [
      { decisionId: "decision-foreign", version: 1 },
    ];

    await expect(
      registry.publishVersion(unit.projectId, unit, manifest)
    ).rejects.toThrow("decisions do not match");
  });

  it("preserves the historical manifest when preparing a rollback", async () => {
    const { registry, unit } = await registryFixture();
    await registry.publishVersion(
      unit.projectId,
      unit,
      manifestFor(unit.id, unit.version)
    );

    const rollback = await registry.rollback(unit.projectId, unit.id, 1);
    const versions = await registry.listVersions(unit.projectId, unit.id);

    expect(rollback?.version).toBe(2);
    expect(versions).toHaveLength(1);
    expect(versions[0].manifest.editorialProvenance?.revisionBriefId).toBe(
      "brief-1"
    );
  });

  it("hashes equivalent projection objects deterministically", () => {
    const first = computeDeterministicHash({ b: 2, a: { y: 2, x: 1 } });
    const second = computeDeterministicHash({ a: { x: 1, y: 2 }, b: 2 });

    expect(first).toBe(second);
  });
});
