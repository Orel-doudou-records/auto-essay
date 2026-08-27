import {
  createEditorialPlan,
  createIntegratedEvaluationContext,
  createProjectionCompiler,
  type ContentStyleArticulation,
  type DraftUnit,
  type EditorialDecision,
  type IntegratedEvaluationContext,
} from "@auto-essay/core";

/**
 * Construit le contexte d’évaluation d’une unité au moment où l’auteur crée
 * explicitement cette unité depuis une décision déjà active. Il ne génère pas
 * de texte : les traces Writer resteront vides jusqu’à une écriture explicite.
 */
export function prepareIntegratedEvaluationContext(input: {
  unit: DraftUnit;
  decision: EditorialDecision;
  articulation: ContentStyleArticulation;
}): IntegratedEvaluationContext {
  const plan = createEditorialPlan({
    unitId: input.unit.id,
    unitVersion: input.unit.version + 1,
    scope: input.decision.scope,
    argumentativeFunction: input.unit.thesis || input.decision.contentCommitments.join(" "),
    decisions: [input.decision],
    claimIds: input.unit.claimIds,
    evidenceIds: input.unit.evidencePack.sourceIds,
    contentOperations: input.decision.contentCommitments,
    stylisticOperations: input.articulation.stylisticOperations,
    intendedEffects: input.articulation.intendedEffects,
    invariants: input.decision.invariants,
    status: "validated",
  });
  const projections = createProjectionCompiler().compile({
    plan,
    decisions: [input.decision],
    articulations: [input.articulation],
  });

  return createIntegratedEvaluationContext({
    writerProjection: projections.writer,
    evaluatorProjection: projections.evaluator,
    transformationTraces: [],
  });
}
