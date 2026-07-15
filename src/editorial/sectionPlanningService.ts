import {
  EditorialScopeSchema,
  type EditorialScope,
  type EditorialScopeInput,
} from "../domain/contentRelation";
import type {
  ArticulationEffectsInput,
  PlannedStylisticOperationInput,
} from "../domain/contentStyleArticulation";
import type { EditorialDecision } from "../domain/editorialDecision";
import {
  EditorialPlanSchema,
  ParagraphEditorialPlanSchema,
  SectionEditorialPlanSchema,
  createEditorialPlan,
  type ParagraphEditorialPlan,
  type SectionEditorialPlan,
} from "../domain/editorialPlan";

export interface ParagraphPlanRequest {
  unitId: string;
  unitVersion: number;
  paragraphId: string;
  order: number;
  argumentativeFunction: string;
  inheritedDecisionIds?: string[];
  localDecisions?: EditorialDecision[];
  claimIds?: string[];
  evidenceIds?: string[];
  sourceRelationIds?: string[];
  contentOperations: string[];
  stylisticOperations: PlannedStylisticOperationInput[];
  intendedEffects: ArticulationEffectsInput;
  invariants?: string[];
}

export interface SectionPlanRequest {
  unitId: string;
  unitVersion: number;
  scope: EditorialScopeInput;
  argumentativeFunction: string;
  decisions: EditorialDecision[];
  claimIds?: string[];
  evidenceIds?: string[];
  sourceRelationIds?: string[];
  contentOperations: string[];
  stylisticOperations: PlannedStylisticOperationInput[];
  intendedEffects: ArticulationEffectsInput;
  invariants?: string[];
  paragraphs: ParagraphPlanRequest[];
}

/**
 * Construit une section et ses paragraphes à partir de décisions déjà actives.
 * Aucun prompt de génération n'est produit à ce stade.
 */
export class SectionPlanningService {
  build(request: SectionPlanRequest): SectionEditorialPlan {
    const sectionScope = EditorialScopeSchema.parse(request.scope);

    if (sectionScope.level !== "section") {
      throw new Error("Section planning requires a section editorial scope");
    }

    if (request.paragraphs.length === 0) {
      throw new Error("A section plan requires at least one paragraph plan");
    }

    assertUniqueParagraphIds(request.paragraphs);
    assertUniqueParagraphOrders(request.paragraphs);
    request.decisions.forEach((decision) =>
      assertDecisionAppliesToScope(decision, sectionScope)
    );

    const sectionPlan = createEditorialPlan({
      unitId: request.unitId,
      unitVersion: request.unitVersion,
      scope: sectionScope,
      argumentativeFunction: request.argumentativeFunction,
      decisions: request.decisions,
      claimIds: request.claimIds,
      evidenceIds: request.evidenceIds,
      sourceRelationIds: request.sourceRelationIds,
      contentOperations: request.contentOperations,
      stylisticOperations: request.stylisticOperations,
      intendedEffects: request.intendedEffects,
      invariants: request.invariants,
      status: "draft",
    });

    const sectionDecisions = new Map(
      request.decisions.map((decision) => [decision.id, decision])
    );
    const paragraphs = request.paragraphs.map((paragraph) =>
      this.buildParagraph(paragraph, sectionScope, sectionDecisions)
    );
    const now = new Date().toISOString();

    return SectionEditorialPlanSchema.parse({
      id: crypto.randomUUID(),
      plan: sectionPlan,
      paragraphs,
      createdAt: now,
      updatedAt: now,
    });
  }

  validate(section: SectionEditorialPlan): SectionEditorialPlan {
    const now = new Date().toISOString();
    const validatedParagraphs = section.paragraphs.map((paragraph) =>
      ParagraphEditorialPlanSchema.parse({
        ...paragraph,
        plan: EditorialPlanSchema.parse({
          ...paragraph.plan,
          status: "validated",
          updatedAt: now,
        }),
        updatedAt: now,
      })
    );

    return SectionEditorialPlanSchema.parse({
      ...section,
      plan: EditorialPlanSchema.parse({
        ...section.plan,
        status: "validated",
        updatedAt: now,
      }),
      paragraphs: validatedParagraphs,
      updatedAt: now,
    });
  }

  private buildParagraph(
    paragraph: ParagraphPlanRequest,
    sectionScope: EditorialScope,
    sectionDecisions: Map<string, EditorialDecision>
  ): ParagraphEditorialPlan {
    const inheritedDecisionIds =
      paragraph.inheritedDecisionIds ?? Array.from(sectionDecisions.keys());
    const inheritedDecisions = inheritedDecisionIds.map((decisionId) => {
      const decision = sectionDecisions.get(decisionId);

      if (!decision) {
        throw new Error(
          `Paragraph ${paragraph.paragraphId} inherits unknown decision ${decisionId}`
        );
      }

      return decision;
    });
    const localDecisions = paragraph.localDecisions ?? [];
    const paragraphScope = EditorialScopeSchema.parse({
      level: "paragraph",
      projectId: sectionScope.projectId,
      sectionId: sectionScope.sectionId,
      paragraphId: paragraph.paragraphId,
    });

    [...inheritedDecisions, ...localDecisions].forEach((decision) =>
      assertDecisionAppliesToScope(decision, paragraphScope)
    );

    const decisions = deduplicateDecisions([
      ...inheritedDecisions,
      ...localDecisions,
    ]);
    const plan = createEditorialPlan({
      unitId: paragraph.unitId,
      unitVersion: paragraph.unitVersion,
      scope: paragraphScope,
      argumentativeFunction: paragraph.argumentativeFunction,
      decisions,
      claimIds: paragraph.claimIds,
      evidenceIds: paragraph.evidenceIds,
      sourceRelationIds: paragraph.sourceRelationIds,
      contentOperations: paragraph.contentOperations,
      stylisticOperations: paragraph.stylisticOperations,
      intendedEffects: paragraph.intendedEffects,
      invariants: paragraph.invariants,
      status: "draft",
    });
    const now = new Date().toISOString();

    return ParagraphEditorialPlanSchema.parse({
      id: crypto.randomUUID(),
      order: paragraph.order,
      plan,
      inheritedDecisionIds,
      localDecisionIds: localDecisions.map((decision) => decision.id),
      createdAt: now,
      updatedAt: now,
    });
  }
}

export function createSectionPlanningService(): SectionPlanningService {
  return new SectionPlanningService();
}

function assertDecisionAppliesToScope(
  decision: EditorialDecision,
  targetScope: EditorialScope
): void {
  if (decision.projectId !== targetScope.projectId) {
    throw new Error(
      `Decision ${decision.id} belongs to another project`
    );
  }

  if (
    decision.scope.level === "section" &&
    decision.scope.sectionId !== targetScope.sectionId
  ) {
    throw new Error(
      `Decision ${decision.id} belongs to another section`
    );
  }

  if (decision.scope.level === "paragraph") {
    if (targetScope.level !== "paragraph") {
      throw new Error(
        `Paragraph decision ${decision.id} cannot be applied to a section plan`
      );
    }

    if (
      decision.scope.sectionId !== targetScope.sectionId ||
      decision.scope.paragraphId !== targetScope.paragraphId
    ) {
      throw new Error(
        `Decision ${decision.id} belongs to another paragraph`
      );
    }
  }
}

function deduplicateDecisions(
  decisions: EditorialDecision[]
): EditorialDecision[] {
  const byId = new Map<string, EditorialDecision>();

  for (const decision of decisions) {
    byId.set(decision.id, decision);
  }

  return Array.from(byId.values());
}

function assertUniqueParagraphIds(paragraphs: ParagraphPlanRequest[]): void {
  const ids = new Set<string>();

  for (const paragraph of paragraphs) {
    if (ids.has(paragraph.paragraphId)) {
      throw new Error(`Duplicate paragraph identifier ${paragraph.paragraphId}`);
    }
    ids.add(paragraph.paragraphId);
  }
}

function assertUniqueParagraphOrders(
  paragraphs: ParagraphPlanRequest[]
): void {
  const orders = new Set<number>();

  for (const paragraph of paragraphs) {
    if (orders.has(paragraph.order)) {
      throw new Error(`Duplicate paragraph order ${paragraph.order}`);
    }
    orders.add(paragraph.order);
  }
}
