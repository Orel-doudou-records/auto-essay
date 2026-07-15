import type { EssayEvaluation } from "../domain/evaluation";
import type { EditorialEffectEvaluation } from "../domain/editorialEffectEvaluation";
import type { RevisionEditorialProjection } from "../domain/editorialProjection";
import type { DraftUnit } from "../domain/draftUnit";
import {
  RevisionBriefSchema,
  createRevisionBrief,
  type RelationalRevisionInstruction,
  type RevisionBrief,
} from "../domain/revision";

export interface RelationalRevisionContext {
  projection: RevisionEditorialProjection;
  editorialEvaluation: EditorialEffectEvaluation;
  sourceEvaluationId?: string;
}

/**
 * Générateur de briefs de révision
 * Auto-génère des briefs à partir des évaluations
 *
 * Inspiré d'autonovel : cette automation est identifiée comme
 * un "gap clé" dans leur PIPELINE.md
 */
export class RevisionBriefGenerator {
  /**
   * Génère un brief de révision à partir d'une évaluation.
   * Le troisième argument est optionnel pour préserver le mode historique.
   */
  generateBrief(
    evaluation: EssayEvaluation,
    unit: DraftUnit,
    relationalContext?: RelationalRevisionContext
  ): RevisionBrief {
    validateRelationalContext(unit, relationalContext);

    const focusAreas = this.identifyFocusAreas(evaluation);
    const specificInstructions = this.generateInstructions(evaluation);
    const brief = createRevisionBrief(
      unit.id,
      relationalContext?.sourceEvaluationId ?? "",
      focusAreas,
      specificInstructions
    );

    brief.evidenceToAdd = evaluation.evidenceGaps.map((gap) => ({
      claim: gap.claim,
      priority: gap.priority,
    }));

    brief.claimsToStrengthen = evaluation.weakClaims.map((claim) => ({
      claim,
      currentIssue:
        evaluation.weaknesses.find((w) => w.description.includes(claim))
          ?.description || "Assertion faible",
      suggestion:
        evaluation.weaknesses.find((w) => w.description.includes(claim))
          ?.suggestedFix || "Renforcer avec des preuves",
    }));

    brief.overclaimsToFix = evaluation.overclaimRisks.map((risk) => ({
      location: risk.location,
      current: risk.claim,
      issue: risk.issue,
      suggestion: risk.suggestion,
    }));

    brief.citationsToAdd = evaluation.citationGaps.map((gap) => ({
      statement: gap.statement,
      priority: gap.priority,
    }));

    if (relationalContext) {
      const relationalInstructions = buildRelationalInstructions(
        unit,
        relationalContext
      );
      const claimProtection =
        "Ne modifier aucun claim, niveau de confiance ou attribution sans réévaluation documentaire.";

      brief.sourceEditorialEvaluationId =
        relationalContext.editorialEvaluation.id;
      brief.editorialProjectionId = relationalContext.projection.id;
      brief.relationalInstructions = relationalInstructions;
      brief.preserveInvariants = unique(relationalContext.projection.preserve);
      brief.prohibitedChanges = unique([
        ...relationalContext.projection.avoid,
        claimProtection,
      ]);
      brief.protectedClaimIds = unique(unit.claimIds);
      brief.specificInstructions.push(
        ...relationalInstructions.map(
          (instruction) =>
            `[Décision ${instruction.decisionId} / articulation ${instruction.articulationId}] ${instruction.instruction}`
        )
      );
    }

    return RevisionBriefSchema.parse(brief);
  }

  /**
   * Identifie les zones de focus prioritaires
   */
  private identifyFocusAreas(
    evaluation: EssayEvaluation
  ): RevisionBrief["focusAreas"] {
    const dimensions = [
      { dim: "claimSupport", score: evaluation.dimensions.claimSupport },
      { dim: "citationIntegrity", score: evaluation.dimensions.citationIntegrity },
      { dim: "counterargumentQuality", score: evaluation.dimensions.counterargumentQuality },
      { dim: "transitionClarity", score: evaluation.dimensions.transitionClarity },
      { dim: "scopeControl", score: evaluation.dimensions.scopeControl },
      { dim: "voiceConsistency", score: evaluation.dimensions.voiceConsistency },
    ].sort((a, b) => a.score - b.score);

    const weakest = dimensions.slice(0, 3);

    return weakest.map((d, i) => ({
      dimension: d.dim as RevisionBrief["focusAreas"][number]["dimension"],
      priority: i + 1,
      description: this.getFocusAreaDescription(d.dim, d.score),
    }));
  }

  /**
   * Génère les instructions spécifiques
   */
  private generateInstructions(evaluation: EssayEvaluation): string[] {
    const instructions: string[] = [];

    switch (evaluation.verdict) {
      case "keep":
        instructions.push("Aucune révision documentaire nécessaire.");
        break;
      case "keep_with_minor_edits":
        instructions.push("Révisions documentaires mineures demandées.");
        break;
      case "revise":
        instructions.push("Révision documentaire substantielle requise.");
        break;
      case "discard":
        instructions.push("Reprise documentaire complète nécessaire.");
        break;
    }

    for (const rev of evaluation.top3Revisions) {
      instructions.push(`${rev.priority}. ${rev.target}: ${rev.approach}`);
    }

    if (evaluation.overclaimRisks.length > 0) {
      instructions.push(
        `Corriger ${evaluation.overclaimRisks.length} sur-assertion(s)`
      );
    }

    if (evaluation.evidenceGaps.length > 0) {
      instructions.push(
        `Ajouter des preuves pour ${evaluation.evidenceGaps.length} affirmation(s)`
      );
    }

    return instructions;
  }

  private getFocusAreaDescription(
    dimension: string,
    score: number
  ): string {
    const descriptions: Record<string, string> = {
      claimSupport:
        score < 5
          ? "Insuffisance critique des preuves"
          : score < 7
            ? "Preuves à renforcer"
            : "Preuves adéquates mais perfectibles",
      citationIntegrity:
        score < 5
          ? "Problèmes majeurs de citations"
          : score < 7
            ? "Citations à vérifier"
            : "Citations correctes",
      counterargumentQuality:
        score < 5
          ? "Objections ignorées ou mal traitées"
          : score < 7
            ? "Objections à développer"
            : "Bon traitement des objections",
      transitionClarity:
        score < 5
          ? "Enchaînements confus"
          : score < 7
            ? "Transitions à clarifier"
            : "Transitions fluides",
      scopeControl:
        score < 5
          ? "Sur-généralisations fréquentes"
          : score < 7
            ? "Portée à préciser"
            : "Bon contrôle de portée",
      voiceConsistency:
        score < 5
          ? "Voix incohérente"
          : score < 7
            ? "Voix à harmoniser"
            : "Voix maintenue",
    };

    return descriptions[dimension] || "À améliorer";
  }
}

export function createRevisionBriefGenerator(): RevisionBriefGenerator {
  return new RevisionBriefGenerator();
}

function validateRelationalContext(
  unit: DraftUnit,
  context?: RelationalRevisionContext
): void {
  if (!context) {
    return;
  }

  if (
    context.projection.unitId !== unit.id ||
    context.projection.unitVersion !== unit.version
  ) {
    throw new Error("Revision projection does not match the target unit");
  }

  if (
    context.editorialEvaluation.unitId !== unit.id ||
    context.editorialEvaluation.unitVersion !== unit.version
  ) {
    throw new Error("Editorial evaluation does not match the target unit");
  }

  if (
    context.projection.planId !== context.editorialEvaluation.planId ||
    context.projection.planId !== unit.editorialPlanId
  ) {
    throw new Error("Revision context plan provenance is inconsistent");
  }
}

function buildRelationalInstructions(
  unit: DraftUnit,
  context: RelationalRevisionContext
): RelationalRevisionInstruction[] {
  const directiveCatalog = new Map(
    context.projection.repairDirectives.map((directive) => [
      directive.id,
      directive,
    ])
  );

  return context.editorialEvaluation.criterionResults
    .filter((result) => result.status !== "effective")
    .map((result) => {
      const directives = result.directiveIds
        .map((directiveId) => directiveCatalog.get(directiveId))
        .filter(
          (directive): directive is NonNullable<typeof directive> =>
            directive !== undefined &&
            (directive.kind === "content" || directive.kind === "form")
        );

      if (directives.length === 0) {
        throw new Error(
          `No repair directive found for editorial criterion ${result.criterionId}`
        );
      }

      return {
        priority: editorialPriority(result.status),
        criterionId: result.criterionId,
        decisionId: result.decisionId,
        articulationId: result.articulationId,
        directiveIds: directives.map((directive) => directive.id),
        issue: [...result.contentFindings, ...result.formFindings].join(" "),
        instruction: [
          result.suggestedRepair,
          `Opérations canoniques: ${directives
            .map((directive) => directive.instruction)
            .join(" | ")}`,
        ]
          .filter(Boolean)
          .join(" "),
        targetExcerpt: result.evidence[0]?.excerpt,
        preserve: context.projection.preserve,
        avoid: context.projection.avoid,
        protectedClaimIds: unit.claimIds,
      };
    })
    .sort((left, right) => left.priority - right.priority);
}

function editorialPriority(
  status: EditorialEffectEvaluation["criterionResults"][number]["status"]
): 1 | 2 | 3 {
  switch (status) {
    case "harmful":
    case "absent":
    case "present_ineffective":
      return 1;
    case "partially_effective":
      return 2;
    case "effective":
      return 3;
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
