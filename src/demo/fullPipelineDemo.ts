import { canBecomeEditorialDecision } from "../domain/contentStyleArticulation";
import { DraftUnitSchema } from "../domain/draftUnit";
import { DeliveryManifestSchema } from "../domain/revision";
import { ArticulationResolver } from "../editorial/articulationResolver";
import { EditorialDecisionService } from "../editorial/editorialDecisionService";
import { ObservationAnalyzer } from "../editorial/observationAnalyzer";
import { ProjectionCompiler } from "../editorial/projectionCompiler";
import { RelationAnalyzer } from "../editorial/relationAnalyzer";
import { SectionPlanningService } from "../editorial/sectionPlanningService";
import {
  EssayEvaluator,
  type StructuredModelClient,
} from "../evaluation/evaluateEssay";
import { ParagraphGenerator } from "../pipeline/paragraphMode";
import { SectionGenerator } from "../pipeline/sectionGenerator";
import { RevisionBriefGenerator } from "../revision/genBrief";
import { createEditorialManifestProvenance } from "../state/index";
import { FileRegistry } from "../state/registry";
import { unique } from "../utils/array";
import {
  buildArticulationClient,
  buildEvaluationClient,
  buildObservationClient,
  buildParagraphClient,
  buildRelationClient,
} from "./pipelineDemoClients";
import {
  buildClaims,
  buildEvidencePack,
  buildParticipantCatalog,
  buildSectionTraces,
  buildSources,
} from "./pipelineDemoBuilders";
import type {
  FullPipelineDemoDefinition,
  FullPipelineDemoOptions,
  FullPipelineDemoResult,
} from "./pipelineDemoTypes";
import { required } from "./pipelineDemoUtils";

/**
 * Exécute le parcours Literacraft intégré depuis les sources jusqu'au manifest.
 * Les réponses structurées sont entièrement déterministes et ancrées au scénario.
 */
export async function runFullPipelineDemo(
  definition: FullPipelineDemoDefinition,
  options: FullPipelineDemoOptions = {}
): Promise<FullPipelineDemoResult> {
  const sources = buildSources(definition);
  const sourceByKey = new Map(
    definition.sources.map((source, index) => [source.key, sources[index]])
  );
  const claims = buildClaims(definition, sourceByKey);
  const claimByKey = new Map(
    definition.claims.map((claim, index) => [claim.key, claims[index]])
  );

  const observationSource = required(
    sourceByKey.get(definition.observation.sourceKey),
    `Unknown observation source ${definition.observation.sourceKey}`
  );
  const observationClient = buildObservationClient(definition.observation);
  const observations = await new ObservationAnalyzer(observationClient).analyze({
    authorId: definition.observation.authorId,
    sourceTextId: observationSource.id,
    sourceText: observationSource.content,
    sourceLabel: definition.observation.sourceLabel,
  });
  observationClient.assertAllRequiredResponsesUsed();

  const participantCatalog = buildParticipantCatalog(sourceByKey, claimByKey);
  const relationClient = buildRelationClient(definition, participantCatalog);
  const relations = await new RelationAnalyzer(relationClient).analyze({
    scope: {
      level: "section",
      projectId: definition.projectId,
      sectionId: definition.sectionId,
    },
    sources,
    claims,
    argumentativeFunction: definition.projectContext,
  });
  const selectedRelation =
    relations.find(
      (relation) => relation.type === definition.preferredRelationType
    ) ?? relations[0];

  if (!selectedRelation) {
    throw new Error("The demonstration requires at least one content relation");
  }

  const articulationClient = buildArticulationClient(
    definition,
    selectedRelation,
    observations
  );
  const candidates = await new ArticulationResolver(articulationClient).resolve({
    scope: selectedRelation.scope,
    relations,
    observations,
    projectContext: definition.projectContext,
    argumentativeFunction: definition.sectionTitle,
    constraints: definition.articulation.invariants,
    maxCandidates: 1,
  });
  const candidate = required(candidates[0], "No articulation candidate produced");
  const candidateExecutableBeforeValidation = canBecomeEditorialDecision(candidate);

  if (candidateExecutableBeforeValidation) {
    throw new Error("A candidate articulation became executable before validation");
  }

  const governance = new EditorialDecisionService().accept(candidate, {
    contentCommitments: definition.articulation.contentCommitments,
    formalCommitments: definition.articulation.formalCommitments,
    invariants: definition.articulation.invariants,
    prohibitedShortcuts: definition.articulation.prohibitedShortcuts,
    validationNote: `Validated for demonstration ${definition.scenarioId}`,
  });
  const decision = governance.decision;
  const articulation = governance.articulation;
  const planningService = new SectionPlanningService();
  const draftPlan = planningService.build({
    unitId: definition.sectionUnitId,
    unitVersion: 1,
    scope: {
      level: "section",
      projectId: definition.projectId,
      sectionId: definition.sectionId,
    },
    argumentativeFunction: definition.sectionTitle,
    decisions: [decision],
    claimIds: claims.map((claim) => claim.id),
    evidenceIds: sources.map((source) => source.id),
    sourceRelationIds: [selectedRelation.id],
    contentOperations: definition.paragraphs.flatMap(
      (paragraph) => paragraph.contentOperations
    ),
    stylisticOperations: articulation.stylisticOperations,
    intendedEffects: articulation.intendedEffects,
    invariants: definition.articulation.invariants,
    paragraphs: definition.paragraphs.map((paragraph, index) => ({
      unitId: paragraph.unitId,
      unitVersion: 1,
      paragraphId: paragraph.paragraphId,
      order: index,
      argumentativeFunction: paragraph.argumentativeFunction,
      claimIds: paragraph.claimKeys.map(
        (key) => required(claimByKey.get(key), `Unknown claim ${key}`).id
      ),
      evidenceIds: paragraph.sourceKeys.map(
        (key) => required(sourceByKey.get(key), `Unknown source ${key}`).id
      ),
      sourceRelationIds: [selectedRelation.id],
      contentOperations: paragraph.contentOperations,
      stylisticOperations: articulation.stylisticOperations,
      intendedEffects: articulation.intendedEffects,
      invariants: definition.articulation.invariants,
    })),
  });
  const plan = planningService.validate(draftPlan);
  const compiler = new ProjectionCompiler();
  const projections = compiler.compile({
    plan: plan.plan,
    decisions: [decision],
    articulations: [articulation],
  });
  const paragraphProjections = plan.paragraphs.map((paragraph) =>
    compiler.compile({
      plan: paragraph.plan,
      decisions: [decision],
      articulations: [articulation],
    })
  );
  const paragraphClient = buildParagraphClient(
    definition,
    paragraphProjections,
    sourceByKey,
    claimByKey
  );
  const generation = await new SectionGenerator(
    new ParagraphGenerator(paragraphClient),
    compiler
  ).generate({
    plan,
    decisions: [decision],
    articulations: [articulation],
    sectionTitle: definition.sectionTitle,
    thesis: definition.thesis,
    paragraphs: definition.paragraphs.map((paragraph) => ({
      unitId: paragraph.unitId,
      sources,
      evidencePack: buildEvidencePack(paragraph, sourceByKey, claimByKey),
    })),
  });
  paragraphClient.assertAllRequiredResponsesUsed();

  const sectionTraces = buildSectionTraces(definition, generation, projections);
  const section = DraftUnitSchema.parse({
    ...generation.section,
    transformationTraceIds: unique([
      ...generation.section.transformationTraceIds,
      ...sectionTraces.map((trace) => trace.id),
    ]),
  });
  const evaluationClient = buildEvaluationClient(
    definition,
    projections,
    sectionTraces
  );
  const evaluation = await new EssayEvaluator(
    evaluationClient,
    `demo:${definition.scenarioId}`
  ).evaluateIntegrated({
    unit: section,
    sources,
    claims,
    editorialProjection: projections.evaluator,
    transformationTraces: sectionTraces,
  });
  evaluationClient.assertAllRequiredResponsesUsed();

  const editorialEvaluation = required(
    evaluation.editorial,
    "The demonstration requires an editorial evaluation"
  );
  const revisionBrief = new RevisionBriefGenerator().generateBrief(
    evaluation.essay,
    section,
    {
      projection: projections.revision,
      editorialEvaluation,
      sourceEvaluationId: `${definition.scenarioId}:integrated-evaluation`,
    }
  );
  const editorialProvenance = createEditorialManifestProvenance({
    planId: plan.plan.id,
    decisions: [decision],
    articulationIds: [articulation.id],
    projections,
    transformationTraceIds: section.transformationTraceIds,
    editorialEffectEvaluationId: editorialEvaluation.id,
    revisionBriefId: revisionBrief.id,
  });
  const manifest = DeliveryManifestSchema.parse({
    version: section.version,
    publishedAt: new Date().toISOString(),
    units: [
      {
        unitId: section.id,
        version: section.version,
        score: evaluation.essay.overallScore,
      },
    ],
    sourcesUsed: section.evidencePack.sourceIds,
    verifiedClaims: claims
      .filter((claim) => claim.status === "verified")
      .map((claim) => claim.id),
    remainingDebts: evaluation.essay.evidenceGaps.map(
      (gap) => `${gap.claim}: ${gap.missingEvidence}`
    ),
    exports: {
      markdown: `${definition.scenarioId}.md`,
    },
    editorialProvenance,
  });
  const registryEntry = options.registryBasePath
    ? await new FileRegistry(options.registryBasePath).publishVersion(
        definition.projectId,
        section,
        manifest
      )
    : undefined;

  return {
    scenarioId: definition.scenarioId,
    sources,
    claims,
    observations,
    relations,
    candidate,
    candidateExecutableBeforeValidation,
    decision,
    plan,
    projections,
    generation,
    section,
    sectionTraces,
    evaluation,
    revisionBrief,
    manifest,
    registryEntry,
  };
}

export type DemoStructuredModelClient = StructuredModelClient;
