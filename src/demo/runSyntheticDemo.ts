import { runSyntheticDemo } from "./syntheticScenario.js";

const result = await runSyntheticDemo({
  registryBasePath:
    process.env.AUTO_ESSAY_DEMO_PATH ?? "./.auto-essay-demo/synthetic",
});

console.log(
  JSON.stringify(
    {
      scenarioId: result.scenarioId,
      sourceCount: result.sources.length,
      claimCount: result.claims.length,
      observationCount: result.observations.length,
      relationCount: result.relations.length,
      candidateExecutableBeforeValidation:
        result.candidateExecutableBeforeValidation,
      paragraphCount: result.generation.paragraphs.length,
      documentaryGate: result.evaluation.gates.documentaryIntegrity,
      editorialGate: result.evaluation.gates.editorialCoherence,
      finalVerdict: result.evaluation.finalVerdict,
      relationalRevisionCount:
        result.revisionBrief.relationalInstructions.length,
      manifestPlanId: result.manifest.editorialProvenance?.planId,
      registryVersion: result.registryEntry?.version,
    },
    null,
    2
  )
);
