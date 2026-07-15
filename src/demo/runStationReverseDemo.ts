import { runStationReverseDemo } from "./stationReverseScenario.js";

async function main(): Promise<void> {
  const result = await runStationReverseDemo({
    registryBasePath:
      process.env.AUTO_ESSAY_DEMO_PATH ?? "./.auto-essay-demo/station-reverse",
  });

  console.log(
    JSON.stringify(
      {
        scenarioId: result.scenarioId,
        sourceTitles: result.sources.map((source) => source.title),
        claimCount: result.claims.length,
        observationCount: result.observations.length,
        selectedRelationTypes: result.relations.map((relation) => relation.type),
        candidateExecutableBeforeValidation:
          result.candidateExecutableBeforeValidation,
        paragraphCount: result.generation.paragraphs.length,
        documentaryGate: result.evaluation.gates.documentaryIntegrity,
        editorialGate: result.evaluation.gates.editorialCoherence,
        finalVerdict: result.evaluation.finalVerdict,
        relationalRevisionCount:
          result.revisionBrief.relationalInstructions.length,
        protectedClaims: result.revisionBrief.protectedClaimIds.length,
        registryVersion: result.registryEntry?.version,
      },
      null,
      2
    )
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
