import {
  EvaluatorEditorialProjectionSchema,
  RevisionEditorialProjectionSchema,
  WriterEditorialProjectionSchema,
  type EditorialDirective,
  type EditorialProjectionBundle,
} from "../domain/editorialProjection";
import type { ContentStyleArticulation } from "../domain/contentStyleArticulation";
import type { EditorialDecision } from "../domain/editorialDecision";
import {
  isEditorialPlanExecutable,
  type EditorialPlan,
} from "../domain/editorialPlan";
import { unique } from "../utils/array";

export interface ProjectionCompilationInput {
  plan: EditorialPlan;
  decisions: EditorialDecision[];
  articulations: ContentStyleArticulation[];
}

/**
 * Compile un plan canonique en vues d'exécution spécialisées.
 * Les projections ne deviennent jamais une nouvelle source de vérité.
 */
export class ProjectionCompiler {
  compile(input: ProjectionCompilationInput): EditorialProjectionBundle {
    if (!isEditorialPlanExecutable(input.plan)) {
      throw new Error(`Editorial plan ${input.plan.id} must be validated before compilation`);
    }

    const decisions = resolveDecisions(input.plan, input.decisions);
    const articulations = resolveArticulations(
      input.plan,
      decisions,
      input.articulations
    );
    const directives = buildDirectives(decisions, articulations);
    const now = new Date().toISOString();
    const base = {
      planId: input.plan.id,
      unitId: input.plan.unitId,
      unitVersion: input.plan.unitVersion,
      scope: input.plan.scope,
      decisionIds: input.plan.decisionIds,
      articulationIds: input.plan.articulationIds,
      createdAt: now,
    };

    const writer = WriterEditorialProjectionSchema.parse({
      ...base,
      id: `${input.plan.id}:writer:${input.plan.updatedAt}`,
      type: "writer",
      argumentativeFunction: input.plan.argumentativeFunction,
      allowedClaimIds: input.plan.claimIds,
      allowedEvidenceIds: input.plan.evidenceIds,
      allowedSourceRelationIds: input.plan.sourceRelationIds,
      directives,
      intendedEffects: input.plan.intendedEffects,
    });

    const evaluator = EvaluatorEditorialProjectionSchema.parse({
      ...base,
      id: `${input.plan.id}:evaluator:${input.plan.updatedAt}`,
      type: "evaluator",
      criteria: decisions.map((decision, index) => ({
        id: `${decision.id}:criterion:${index}`,
        decisionId: decision.id,
        articulationId: decision.articulationId,
        directiveIds: directives
          .filter((directive) => directive.decisionId === decision.id)
          .map((directive) => directive.id),
        instruction: [
          ...decision.contentCommitments,
          ...decision.formalCommitments,
        ].join(" | "),
        expectedContentEffects: input.plan.intendedEffects.content,
        expectedFormEffects: input.plan.intendedEffects.form,
      })),
      intendedEffects: input.plan.intendedEffects,
    });

    const revision = RevisionEditorialProjectionSchema.parse({
      ...base,
      id: `${input.plan.id}:revision:${input.plan.updatedAt}`,
      type: "revision",
      preserve: unique(decisions.flatMap((decision) => decision.invariants)),
      avoid: unique(
        decisions.flatMap((decision) => decision.prohibitedShortcuts)
      ),
      repairDirectives: directives,
    });

    return { writer, evaluator, revision };
  }
}

export function createProjectionCompiler(): ProjectionCompiler {
  return new ProjectionCompiler();
}

function resolveDecisions(
  plan: EditorialPlan,
  catalog: EditorialDecision[]
): EditorialDecision[] {
  const byId = new Map(catalog.map((decision) => [decision.id, decision]));

  return plan.decisionIds.map((decisionId) => {
    const decision = byId.get(decisionId);

    if (!decision) {
      throw new Error(`Editorial plan references unknown decision ${decisionId}`);
    }
    if (decision.status !== "active") {
      throw new Error(`Editorial plan references inactive decision ${decisionId}`);
    }
    if (decision.projectId !== plan.scope.projectId) {
      throw new Error(`Decision ${decisionId} belongs to another project`);
    }

    return decision;
  });
}

function resolveArticulations(
  plan: EditorialPlan,
  decisions: EditorialDecision[],
  catalog: ContentStyleArticulation[]
): Map<string, ContentStyleArticulation> {
  const byId = new Map(catalog.map((articulation) => [articulation.id, articulation]));
  const resolved = new Map<string, ContentStyleArticulation>();

  for (const decision of decisions) {
    if (!plan.articulationIds.includes(decision.articulationId)) {
      throw new Error(
        `Decision ${decision.id} references articulation outside plan ${decision.articulationId}`
      );
    }

    const articulation = byId.get(decision.articulationId);
    if (!articulation) {
      throw new Error(
        `Editorial plan references unknown articulation ${decision.articulationId}`
      );
    }
    if (articulation.status !== "accepted" && articulation.status !== "modified") {
      throw new Error(`Articulation ${articulation.id} is not author-validated`);
    }

    resolved.set(articulation.id, articulation);
  }

  return resolved;
}

function buildDirectives(
  decisions: EditorialDecision[],
  articulations: Map<string, ContentStyleArticulation>
): EditorialDirective[] {
  const directives: EditorialDirective[] = [];

  for (const decision of decisions) {
    const articulation = articulations.get(decision.articulationId)!;

    decision.contentCommitments.forEach((instruction, index) => {
      directives.push({
        id: `${decision.id}:content:${index}`,
        decisionId: decision.id,
        articulationId: articulation.id,
        kind: "content",
        instruction,
      });
    });

    decision.formalCommitments.forEach((instruction, index) => {
      directives.push({
        id: `${decision.id}:form:${index}`,
        decisionId: decision.id,
        articulationId: articulation.id,
        kind: "form",
        instruction,
      });
    });

    articulation.stylisticOperations.forEach((operation, index) => {
      directives.push({
        id: `${decision.id}:operation:${index}`,
        decisionId: decision.id,
        articulationId: articulation.id,
        kind: "form",
        instruction: operation.operation,
        operation,
      });
    });

    decision.invariants.forEach((instruction, index) => {
      directives.push({
        id: `${decision.id}:invariant:${index}`,
        decisionId: decision.id,
        articulationId: articulation.id,
        kind: "invariant",
        instruction,
      });
    });

    decision.prohibitedShortcuts.forEach((instruction, index) => {
      directives.push({
        id: `${decision.id}:prohibition:${index}`,
        decisionId: decision.id,
        articulationId: articulation.id,
        kind: "prohibition",
        instruction,
      });
    });
  }

  return directives;
}

