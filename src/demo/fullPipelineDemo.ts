import {
  createClaim,
  type Claim,
  type ClaimType,
  type ConfidenceLevel,
} from "../domain/claim";
import {
  canBecomeEditorialDecision,
  type ArticulationEffectsInput,
  type ContentStyleArticulation,
  type PlannedStylisticOperationInput,
} from "../domain/contentStyleArticulation";
import type {
  ContentRelation,
  ContentRelationParticipant,
  ContentRelationType,
} from "../domain/contentRelation";
import {
  DraftUnitSchema,
  type DraftUnit,
  type EvidencePack,
} from "../domain/draftUnit";
import type { EditorialDecision } from "../domain/editorialDecision";
import type { EditorialProjectionBundle } from "../domain/editorialProjection";
import type { SectionEditorialPlan } from "../domain/editorialPlan";
import {
  DeliveryManifestSchema,
  type DeliveryManifest,
  type RevisionBrief,
} from "../domain/revision";
import {
  createSource,
  type Source,
  type SourceInput,
  type SourceRegime,
} from "../domain/source";
import type {
  ObservedEffectsInput,
  ObservedStylisticOperationInput,
  StyleObservation,
} from "../domain/styleObservation";
import {
  createTransformationTrace,
  type TransformationTrace,
} from "../domain/transformationTrace";
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
import type { IntegratedEvaluation } from "../domain/editorialEffectEvaluation";
import { ParagraphGenerator } from "../pipeline/paragraphMode";
import {
  SectionGenerator,
  type SectionGenerationResult,
} from "../pipeline/sectionGenerator";
import { RevisionBriefGenerator } from "../revision/genBrief";
import {
  createEditorialManifestProvenance,
  type VersionEntry,
} from "../state/index";
import { FileRegistry } from "../state/registry";
import {
  CallbackStructuredClient,
  ScriptedStructuredClient,
} from "./scriptedClient";

export interface DemoSourceDefinition {
  key: string;
  title: string;
  content: string;
  type?: SourceInput["type"];
  regime?: SourceRegime;
  authors?: string[];
  epistemicLimits?: string[];
  verificationStatus?: SourceInput["verificationStatus"];
  position?: SourceInput["position"];
}

export interface DemoClaimDefinition {
  key: string;
  statement: string;
  sourceKeys: string[];
  confidenceLevel: ConfidenceLevel;
  claimType?: ClaimType;
  contradictionOfKey?: string;
}

export interface DemoObservationDefinition {
  sourceKey: string;
  authorId: string;
  sourceLabel: string;
  excerpt: string;
  argumentativeFunction: string;
  claimTypes?: ClaimType[];
  sourceRegimes?: SourceRegime[];
  relations?: string[];
  tensions?: string[];
  concepts?: string[];
  operation: ObservedStylisticOperationInput;
  effects: ObservedEffectsInput;
  confidence?: "low" | "medium" | "high";
  notes?: string[];
}

export interface DemoRelationDefinition {
  type: ContentRelationType;
  participants: Array<{
    kind: ContentRelationParticipant["kind"];
    key: string;
    role?: string;
  }>;
  description: string;
  evidence: Array<{
    kind: ContentRelationParticipant["kind"];
    key: string;
  }>;
  confidence?: "low" | "medium" | "high";
}

export interface DemoParagraphDefinition {
  unitId: string;
  paragraphId: string;
  argumentativeFunction: string;
  sourceKeys: string[];
  claimKeys: string[];
  contentOperations: string[];
  content: string;
  traceExcerpt: string;
  traceDeclaration: string;
}

export interface DemoEditorialAssessment {
  status:
    | "absent"
    | "present_ineffective"
    | "partially_effective"
    | "effective"
    | "harmful";
  contentScore: number;
  formScore: number;
  contentFindings: string[];
  formFindings: string[];
  evidenceExcerpt?: string;
  unintendedEffects?: string[];
  suggestedRepair?: string;
  contentFormCoherence: number;
  overallEditorialScore: number;
  summary: string;
}

export interface FullPipelineDemoDefinition {
  scenarioId: string;
  projectId: string;
  sectionId: string;
  sectionUnitId: string;
  sectionTitle: string;
  thesis: string;
  projectContext: string;
  sources: DemoSourceDefinition[];
  claims: DemoClaimDefinition[];
  observation: DemoObservationDefinition;
  additionalRelation?: DemoRelationDefinition;
  preferredRelationType?: ContentRelationType;
  articulation: {
    operation: PlannedStylisticOperationInput;
    effects: ArticulationEffectsInput;
    contentCommitments: string[];
    formalCommitments: string[];
    invariants: string[];
    prohibitedShortcuts: string[];
    risks?: Array<{
      description: string;
      impact: "low" | "medium" | "high";
      mitigation?: string;
    }>;
  };
  paragraphs: DemoParagraphDefinition[];
  essayAssessment: {
    overallScore: number;
    dimensions: {
      claimSupport: number;
      citationIntegrity: number;
      counterargumentQuality: number;
      transitionClarity: number;
      scopeControl: number;
      voiceConsistency: number;
    };
    verdict: "keep" | "keep_with_minor_edits" | "revise" | "discard";
    weaknesses?: Array<{
      dimension:
        | "claimSupport"
        | "citationIntegrity"
        | "counterargumentQuality"
        | "transitionClarity"
        | "scopeControl"
        | "voiceConsistency";
      description: string;
      severity: "critical" | "major" | "minor";
      location?: string;
      suggestedFix?: string;
    }>;
    top3Revisions?: Array<{
      priority: 1 | 2 | 3;
      target: string;
      issue: string;
      approach: string;
    }>;
  };
  editorialAssessment: DemoEditorialAssessment;
}

export interface FullPipelineDemoOptions {
  registryBasePath?: string;
}

export interface FullPipelineDemoResult {
  scenarioId: string;
  sources: Source[];
  claims: Claim[];
  observations: StyleObservation[];
  relations: ContentRelation[];
  candidate: ContentStyleArticulation;
  candidateExecutableBeforeValidation: boolean;
  decision: EditorialDecision;
  plan: SectionEditorialPlan;
  projections: EditorialProjectionBundle;
  generation: SectionGenerationResult;
  section: DraftUnit;
  sectionTraces: TransformationTrace[];
  evaluation: IntegratedEvaluation;
  revisionBrief: RevisionBrief;
  manifest: DeliveryManifest;
  registryEntry?: VersionEntry;
}

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
  const observationClient = new ScriptedStructuredClient([
    {
      label: "observation-analysis",
      match: "Tu analyses un passage comme une relation entre matière et écriture.",
      respond: buildObservationResponse(definition.observation),
    },
  ]);
  const observations = await new ObservationAnalyzer(observationClient).analyze({
    authorId: definition.observation.authorId,
    sourceTextId: observationSource.id,
    sourceText: observationSource.content,
    sourceLabel: definition.observation.sourceLabel,
  });
  observationClient.assertAllRequiredResponsesUsed();

  const participantCatalog = buildParticipantCatalog(sourceByKey, claimByKey);
  const relationClient = definition.additionalRelation
    ? new CallbackStructuredClient(() => ({
        relations: [
          materializeRelation(definition.additionalRelation!, participantCatalog),
        ],
      }))
    : undefined;
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

  const articulationClient = new CallbackStructuredClient(() => ({
    candidates: [
      {
        contentRelationIds: [selectedRelation.id],
        supportingObservationIds: observations.map(
          (observation) => observation.id
        ),
        stylisticOperations: [definition.articulation.operation],
        intendedEffects: definition.articulation.effects,
        support: {
          level: observations.length > 0 ? "moderate" : "weak",
          rationale:
            observations.length > 0
              ? "Une opération analogue est localisée dans le corpus de référence."
              : "La proposition repose uniquement sur la fonction éditoriale du projet.",
        },
        risks: definition.articulation.risks ?? [],
        alternatives: [],
      },
    ],
  }));
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
  const paragraphClient = new ScriptedStructuredClient(
    definition.paragraphs.map((paragraph, index) => ({
      label: `paragraph-${index + 1}`,
      match: "Tu travailles en mode PARAGRAPHE.",
      respond: buildParagraphResponse(
        paragraph,
        paragraphProjections[index].writer,
        sourceByKey,
        claimByKey
      ),
    }))
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

  const traceDirective = required(
    projections.writer.directives.find(
      (directive) => directive.kind === "form" || directive.kind === "content"
    ),
    "The demonstration requires a traceable writer directive"
  );
  const sectionTraces = definition.paragraphs.map((paragraph) =>
    createTransformationTrace(
      generation.section.id,
      generation.section.version,
      projections.writer,
      {
        directiveId: traceDirective.id,
        decisionId: traceDirective.decisionId,
        articulationId: traceDirective.articulationId,
        declaration: paragraph.traceDeclaration,
        excerpt: paragraph.traceExcerpt,
      }
    )
  );
  const section = DraftUnitSchema.parse({
    ...generation.section,
    transformationTraceIds: unique([
      ...generation.section.transformationTraceIds,
      ...sectionTraces.map((trace) => trace.id),
    ]),
  });
  const evaluationClient = new ScriptedStructuredClient([
    {
      label: "documentary-evaluation",
      match: "Tu es un évaluateur critique d'essais académiques.",
      respond: buildEssayEvaluationResponse(definition),
    },
    {
      label: "editorial-effect-evaluation",
      match: "Tu es le juge éditorial indépendant d'Auto Essay.",
      respond: buildEditorialEvaluationResponse(
        definition,
        projections,
        sectionTraces
      ),
    },
  ]);
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

function buildSources(definition: FullPipelineDemoDefinition): Source[] {
  return definition.sources.map((source) =>
    createSource({
      projectId: definition.projectId,
      title: source.title,
      content: source.content,
      type: source.type ?? "note",
      regime: source.regime,
      authors: source.authors ?? [],
      epistemicLimits: source.epistemicLimits ?? [],
      verificationStatus: source.verificationStatus ?? "verified",
      position: source.position,
    })
  );
}

function buildClaims(
  definition: FullPipelineDemoDefinition,
  sourceByKey: Map<string, Source>
): Claim[] {
  const claimByKey = new Map<string, Claim>();

  return definition.claims.map((claim) => {
    const created = createClaim({
      projectId: definition.projectId,
      statement: claim.statement,
      sourceIds: claim.sourceKeys.map(
        (key) => required(sourceByKey.get(key), `Unknown source ${key}`).id
      ),
      confidenceLevel: claim.confidenceLevel,
      claimType: claim.claimType ?? "interpretation",
      contradictionOf: claim.contradictionOfKey
        ? required(
            claimByKey.get(claim.contradictionOfKey),
            `Contradicted claim ${claim.contradictionOfKey} must be declared first`
          ).id
        : undefined,
      status: "verified",
      scope: "section",
    });
    claimByKey.set(claim.key, created);
    return created;
  });
}

function buildObservationResponse(
  observation: DemoObservationDefinition
): unknown {
  return {
    observations: [
      {
        contentConfiguration: {
          argumentativeFunction: observation.argumentativeFunction,
          claimTypes: observation.claimTypes ?? [],
          sourceRegimes: observation.sourceRegimes ?? [],
          relations: observation.relations ?? [],
          tensions: observation.tensions ?? [],
          concepts: observation.concepts ?? [],
        },
        formalOperations: [observation.operation],
        observedEffects: observation.effects,
        evidence: {
          excerpt: observation.excerpt,
        },
        confidence: observation.confidence ?? "high",
        maturity: "single_observation",
        notes: observation.notes ?? [],
      },
    ],
  };
}

function buildParticipantCatalog(
  sourceByKey: Map<string, Source>,
  claimByKey: Map<string, Claim>
): Map<ContentRelationParticipant["kind"], Map<string, string>> {
  return new Map([
    [
      "source",
      new Map([...sourceByKey.entries()].map(([key, source]) => [key, source.id])),
    ],
    [
      "claim",
      new Map([...claimByKey.entries()].map(([key, claim]) => [key, claim.id])),
    ],
    ["concept", new Map<string, string>()],
    ["tension", new Map<string, string>()],
    ["unit", new Map<string, string>()],
  ]);
}

function materializeRelation(
  relation: DemoRelationDefinition,
  catalog: Map<ContentRelationParticipant["kind"], Map<string, string>>
): unknown {
  const resolve = (
    kind: ContentRelationParticipant["kind"],
    key: string
  ): string =>
    required(catalog.get(kind)?.get(key), `Unknown ${kind} relation key ${key}`);

  return {
    type: relation.type,
    participants: relation.participants.map((participant) => ({
      kind: participant.kind,
      id: resolve(participant.kind, participant.key),
      role: participant.role,
    })),
    description: relation.description,
    evidenceIds: relation.evidence.map((evidence) =>
      resolve(evidence.kind, evidence.key)
    ),
    confidence: relation.confidence ?? "high",
  };
}

function buildEvidencePack(
  paragraph: DemoParagraphDefinition,
  sourceByKey: Map<string, Source>,
  claimByKey: Map<string, Claim>
): EvidencePack {
  return {
    sourceIds: paragraph.sourceKeys.map(
      (key) => required(sourceByKey.get(key), `Unknown source ${key}`).id
    ),
    keyCitations: [],
    supportingClaimIds: paragraph.claimKeys.map(
      (key) => required(claimByKey.get(key), `Unknown claim ${key}`).id
    ),
    objections: [],
    authorNotes: paragraph.argumentativeFunction,
  };
}

function buildParagraphResponse(
  paragraph: DemoParagraphDefinition,
  projection: EditorialProjectionBundle["writer"],
  sourceByKey: Map<string, Source>,
  claimByKey: Map<string, Claim>
): unknown {
  const directive = required(
    projection.directives.find(
      (candidate) => candidate.kind === "form" || candidate.kind === "content"
    ),
    `No traceable directive for paragraph ${paragraph.paragraphId}`
  );

  return {
    plan_3_sentences: [paragraph.argumentativeFunction],
    paragraph: paragraph.content,
    claims: paragraph.claimKeys.map((key) => {
      const claim = required(claimByKey.get(key), `Unknown claim ${key}`);
      return {
        statement: claim.statement,
        confidenceLevel: claim.confidenceLevel,
        sourceIds: paragraph.sourceKeys.map(
          (sourceKey) =>
            required(sourceByKey.get(sourceKey), `Unknown source ${sourceKey}`).id
        ),
      };
    }),
    confidence_assessment: "high",
    applied_directives: [
      {
        directiveId: directive.id,
        decisionId: directive.decisionId,
        articulationId: directive.articulationId,
        declaration: paragraph.traceDeclaration,
        excerpt: paragraph.traceExcerpt,
      },
    ],
  };
}

function buildEssayEvaluationResponse(
  definition: FullPipelineDemoDefinition
): unknown {
  return {
    overallScore: definition.essayAssessment.overallScore,
    dimensions: definition.essayAssessment.dimensions,
    weaknesses: definition.essayAssessment.weaknesses ?? [],
    strongClaims: definition.claims.map((claim) => claim.statement),
    weakClaims: [],
    aiPatternsDetected: [],
    overclaimRisks: [],
    top3Revisions: definition.essayAssessment.top3Revisions ?? [],
    newClaimEntries: [],
    evidenceGaps: [],
    citationGaps: [],
    verdict: definition.essayAssessment.verdict,
  };
}

function buildEditorialEvaluationResponse(
  definition: FullPipelineDemoDefinition,
  projections: EditorialProjectionBundle,
  traces: TransformationTrace[]
): unknown {
  const assessment = definition.editorialAssessment;

  return {
    criterionResults: projections.evaluator.criteria.map((criterion) => ({
      criterionId: criterion.id,
      decisionId: criterion.decisionId,
      articulationId: criterion.articulationId,
      directiveIds: criterion.directiveIds,
      traceIds: traces
        .filter(
          (trace) =>
            trace.decisionId === criterion.decisionId &&
            criterion.directiveIds.includes(trace.directiveId)
        )
        .map((trace) => trace.id),
      status: assessment.status,
      contentScore: assessment.contentScore,
      formScore: assessment.formScore,
      contentFindings: assessment.contentFindings,
      formFindings: assessment.formFindings,
      evidence: assessment.evidenceExcerpt
        ? [{ excerpt: assessment.evidenceExcerpt }]
        : [],
      unintendedEffects: assessment.unintendedEffects ?? [],
      suggestedRepair:
        assessment.status === "effective"
          ? undefined
          : assessment.suggestedRepair ??
            "Réappliquer l'opération au passage ciblé sans modifier les claims.",
    })),
    contentFormCoherence: assessment.contentFormCoherence,
    overallEditorialScore: assessment.overallEditorialScore,
    summary: assessment.summary,
  };
}

function required<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new Error(message);
  }
  return value;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export type DemoStructuredModelClient = StructuredModelClient;
