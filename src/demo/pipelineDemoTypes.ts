import type {
  Claim,
  ClaimType,
  ConfidenceLevel,
} from "../domain/claim";
import type {
  ArticulationEffectsInput,
  PlannedStylisticOperationInput,
} from "../domain/contentStyleArticulation";
import type {
  ContentRelation,
  ContentRelationParticipant,
  ContentRelationType,
} from "../domain/contentRelation";
import type { DraftUnit } from "../domain/draftUnit";
import type { EditorialDecision } from "../domain/editorialDecision";
import type { EditorialProjectionBundle } from "../domain/editorialProjection";
import type { SectionEditorialPlan } from "../domain/editorialPlan";
import type { DeliveryManifest, RevisionBrief } from "../domain/revision";
import type { Source, SourceInput, SourceRegime } from "../domain/source";
import type {
  ObservedEffectsInput,
  ObservedStylisticOperationInput,
  StyleObservation,
} from "../domain/styleObservation";
import type { SectionGenerationResult } from "../pipeline/sectionGenerator";
import type { IntegratedEvaluation } from "../domain/editorialEffectEvaluation";
import type { TransformationTrace } from "../domain/transformationTrace";
import type { VersionEntry } from "../state/index";

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
  candidate: import("../domain/contentStyleArticulation").ContentStyleArticulation;
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
