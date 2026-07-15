import type { Source } from "../domain/source";
import {
  DraftUnitSchema,
  type DraftUnit,
  type EvidencePack,
} from "../domain/draftUnit";
import type { EditorialDecision } from "../domain/editorialDecision";
import type { ContentStyleArticulation } from "../domain/contentStyleArticulation";
import {
  isEditorialPlanExecutable,
  type ParagraphEditorialPlan,
  type SectionEditorialPlan,
} from "../domain/editorialPlan";
import type { TransformationTrace } from "../domain/transformationTrace";
import {
  ProjectionCompiler,
  type ProjectionCompilationInput,
} from "../editorial/projectionCompiler";
import {
  ParagraphGenerator,
  type ParagraphGenerationResult,
} from "./paragraphMode";

export interface ParagraphExecutionInput {
  unitId: string;
  evidencePack: EvidencePack;
  sources: Source[];
}

export interface SectionGenerationRequest {
  plan: SectionEditorialPlan;
  decisions: EditorialDecision[];
  articulations: ContentStyleArticulation[];
  paragraphs: ParagraphExecutionInput[];
  sectionTitle?: string;
  thesis?: string;
}

export interface SectionGenerationResult {
  section: DraftUnit;
  paragraphs: DraftUnit[];
  paragraphResults: ParagraphGenerationResult[];
  transformationTraces: TransformationTrace[];
}

/**
 * Exécute un plan de section validé, paragraphe par paragraphe.
 * Aucun résultat partiel n'est retourné lorsqu'une génération échoue.
 */
export class SectionGenerator {
  constructor(
    private readonly paragraphGenerator: ParagraphGenerator,
    private readonly projectionCompiler: ProjectionCompiler = new ProjectionCompiler()
  ) {}

  async generate(
    request: SectionGenerationRequest
  ): Promise<SectionGenerationResult> {
    assertExecutableSectionPlan(request.plan);
    const inputByUnitId = validateExecutionInputs(
      request.plan,
      request.paragraphs
    );
    const orderedPlans = [...request.plan.paragraphs].sort(
      (left, right) => left.order - right.order
    );
    const generatedUnits: DraftUnit[] = [];
    const paragraphResults: ParagraphGenerationResult[] = [];
    const traces: TransformationTrace[] = [];
    const precedingContents: string[] = [];

    for (const paragraphPlan of orderedPlans) {
      const executionInput = inputByUnitId.get(paragraphPlan.plan.unitId)!;
      const projection = this.projectionCompiler.compile(
        projectionInput(paragraphPlan, request)
      ).writer;
      const result = await this.paragraphGenerator.generateParagraph(
        executionInput.evidencePack,
        executionInput.sources,
        {
          section:
            request.sectionTitle ?? request.plan.plan.argumentativeFunction,
          precedingText:
            precedingContents.length > 0
              ? precedingContents.join("\n\n")
              : undefined,
          thesis: request.thesis,
          unitId: paragraphPlan.plan.unitId,
          unitVersion: paragraphPlan.plan.unitVersion,
          editorialProjection: projection,
        }
      );

      const unit = createParagraphUnit(
        paragraphPlan,
        executionInput.evidencePack,
        result,
        request,
        generatedUnits.map((candidate) => candidate.id)
      );

      generatedUnits.push(unit);
      paragraphResults.push(result);
      traces.push(...result.transformationTraces);
      precedingContents.push(result.content);
    }

    const section = createSectionUnit(request, generatedUnits, traces);

    return {
      section,
      paragraphs: generatedUnits,
      paragraphResults,
      transformationTraces: traces,
    };
  }
}

export function createSectionGenerator(
  paragraphGenerator: ParagraphGenerator,
  projectionCompiler?: ProjectionCompiler
): SectionGenerator {
  return new SectionGenerator(paragraphGenerator, projectionCompiler);
}

function projectionInput(
  paragraphPlan: ParagraphEditorialPlan,
  request: SectionGenerationRequest
): ProjectionCompilationInput {
  return {
    plan: paragraphPlan.plan,
    decisions: request.decisions,
    articulations: request.articulations,
  };
}

function assertExecutableSectionPlan(plan: SectionEditorialPlan): void {
  if (!isEditorialPlanExecutable(plan.plan)) {
    throw new Error(`Section editorial plan ${plan.plan.id} is not validated`);
  }

  const nonExecutableParagraph = plan.paragraphs.find(
    (paragraph) => !isEditorialPlanExecutable(paragraph.plan)
  );

  if (nonExecutableParagraph) {
    throw new Error(
      `Paragraph editorial plan ${nonExecutableParagraph.plan.id} is not validated`
    );
  }
}

function validateExecutionInputs(
  plan: SectionEditorialPlan,
  inputs: ParagraphExecutionInput[]
): Map<string, ParagraphExecutionInput> {
  const inputByUnitId = new Map<string, ParagraphExecutionInput>();

  for (const input of inputs) {
    if (inputByUnitId.has(input.unitId)) {
      throw new Error(`Duplicate execution input for unit ${input.unitId}`);
    }
    inputByUnitId.set(input.unitId, input);
  }

  const expectedUnitIds = new Set(
    plan.paragraphs.map((paragraph) => paragraph.plan.unitId)
  );

  for (const unitId of expectedUnitIds) {
    if (!inputByUnitId.has(unitId)) {
      throw new Error(`Missing execution input for paragraph unit ${unitId}`);
    }
  }

  for (const unitId of inputByUnitId.keys()) {
    if (!expectedUnitIds.has(unitId)) {
      throw new Error(`Unexpected execution input for unit ${unitId}`);
    }
  }

  return inputByUnitId;
}

function createParagraphUnit(
  paragraphPlan: ParagraphEditorialPlan,
  evidencePack: EvidencePack,
  result: ParagraphGenerationResult,
  request: SectionGenerationRequest,
  precedingUnitIds: string[]
): DraftUnit {
  const now = new Date().toISOString();

  return DraftUnitSchema.parse({
    id: paragraphPlan.plan.unitId,
    projectId: paragraphPlan.plan.scope.projectId,
    granularity: "paragraph",
    targetWordCount: 200,
    thesis: request.thesis,
    contextInPlan: {
      section:
        request.sectionTitle ?? request.plan.plan.argumentativeFunction,
      precedingUnits: precedingUnitIds,
    },
    evidencePack,
    content: result.content,
    claimIds: paragraphPlan.plan.claimIds,
    editorialPlanId: paragraphPlan.plan.id,
    appliedDecisionIds: result.appliedDecisionIds,
    appliedArticulationIds: result.appliedArticulationIds,
    transformationTraceIds: result.transformationTraces.map(
      (trace) => trace.id
    ),
    status: "drafting",
    version: paragraphPlan.plan.unitVersion,
    createdAt: now,
    updatedAt: now,
  });
}

function createSectionUnit(
  request: SectionGenerationRequest,
  paragraphs: DraftUnit[],
  traces: TransformationTrace[]
): DraftUnit {
  const evidencePack = aggregateEvidencePacks(
    request.paragraphs.map((paragraph) => paragraph.evidencePack)
  );
  const now = new Date().toISOString();

  return DraftUnitSchema.parse({
    id: request.plan.plan.unitId,
    projectId: request.plan.plan.scope.projectId,
    granularity: "section",
    targetWordCount: Math.max(1, paragraphs.length * 200),
    thesis: request.thesis,
    contextInPlan: {
      section:
        request.sectionTitle ?? request.plan.plan.argumentativeFunction,
      precedingUnits: [],
    },
    evidencePack,
    content: paragraphs.map((paragraph) => paragraph.content).join("\n\n"),
    claimIds: unique(paragraphs.flatMap((paragraph) => paragraph.claimIds)),
    editorialPlanId: request.plan.plan.id,
    appliedDecisionIds: unique(
      paragraphs.flatMap((paragraph) => paragraph.appliedDecisionIds)
    ),
    appliedArticulationIds: unique(
      paragraphs.flatMap((paragraph) => paragraph.appliedArticulationIds)
    ),
    transformationTraceIds: traces.map((trace) => trace.id),
    status: "drafting",
    version: request.plan.plan.unitVersion,
    createdAt: now,
    updatedAt: now,
  });
}

function aggregateEvidencePacks(packs: EvidencePack[]): EvidencePack {
  const authorNotes = packs
    .map((pack) => pack.authorNotes)
    .filter((note): note is string => Boolean(note))
    .join("\n\n");

  return {
    sourceIds: unique(packs.flatMap((pack) => pack.sourceIds)),
    keyCitations: packs.flatMap((pack) => pack.keyCitations),
    supportingClaimIds: unique(
      packs.flatMap((pack) => pack.supportingClaimIds)
    ),
    objections: packs.flatMap((pack) => pack.objections),
    authorNotes: authorNotes || undefined,
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
