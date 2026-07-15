import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runStationReverseDemo } from "../src/demo/stationReverseScenario";
import { runSyntheticDemo } from "../src/demo/syntheticScenario";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  );
});

async function demoDirectory(label: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), `auto-essay-${label}-`));
  temporaryDirectories.push(directory);
  return directory;
}

describe("full Literacraft demonstrations", () => {
  it("executes the synthetic path from grounded observation to registry manifest", async () => {
    const result = await runSyntheticDemo({
      registryBasePath: await demoDirectory("synthetic"),
    });

    expect(result.candidateExecutableBeforeValidation).toBe(false);
    expect(result.decision.status).toBe("active");
    expect(result.plan.plan.status).toBe("validated");
    expect(result.generation.paragraphs).toHaveLength(2);
    expect(result.section.granularity).toBe("section");
    expect(result.sectionTraces).toHaveLength(2);
    expect(result.evaluation.gates).toEqual({
      documentaryIntegrity: "pass",
      editorialCoherence: "fail",
    });
    expect(result.evaluation.finalVerdict).toBe("revise");
    expect(result.revisionBrief.relationalInstructions.length).toBeGreaterThan(0);
    expect(result.revisionBrief.protectedClaimIds).toEqual(
      expect.arrayContaining(result.section.claimIds)
    );
    expect(result.manifest.editorialProvenance).toEqual(
      expect.objectContaining({
        planId: result.section.editorialPlanId,
        articulationIds: result.section.appliedArticulationIds,
        transformationTraceIds: result.section.transformationTraceIds,
      })
    );
    expect(result.registryEntry?.version).toBe(1);
    expect(result.registryEntry?.manifest.editorialProvenance?.planId).toBe(
      result.plan.plan.id
    );
  });

  it("executes the Station Reverse case without turning its corpus into a global style profile", async () => {
    const result = await runStationReverseDemo({
      registryBasePath: await demoDirectory("station-reverse"),
    });

    expect(result.sources.map((source) => source.title)).toEqual([
      "Charte maître — Nexus Diaspora",
      "SPR — Nexus Diaspora / Erykah Badu",
    ]);
    expect(result.sources.every((source) => source.epistemicLimits.length > 0)).toBe(
      true
    );
    expect(result.relations.some((relation) => relation.type === "reframes")).toBe(
      true
    );
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0].contentConfiguration.tensions).toContain(
      "intensité poétique contre justesse documentaire"
    );
    expect(result.generation.paragraphs).toHaveLength(3);
    expect(result.section.content).toContain(
      "La limite documentaire demeure dans le texte"
    );
    expect(result.evaluation.gates.documentaryIntegrity).toBe("pass");
    expect(result.evaluation.gates.editorialCoherence).toBe("fail");
    expect(result.revisionBrief.preserveInvariants).toContain(
      "La beauté du texte vient après sa justesse."
    );
    expect(result.revisionBrief.prohibitedChanges).toContain(
      "Ne modifier aucun claim, niveau de confiance ou attribution sans réévaluation documentaire."
    );
    expect(result.registryEntry?.manifest.sourcesUsed).toEqual(
      result.section.evidencePack.sourceIds
    );
    expect("profile" in result).toBe(false);
  });
});
