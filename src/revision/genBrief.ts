import type { EssayEvaluation } from "../domain/evaluation";
import type { DraftUnit } from "../domain/draftUnit";
import { createRevisionBrief, type RevisionBrief } from "../domain/revision";

/**
 * Générateur de briefs de révision
 * Auto-génère des briefs à partir des évaluations
 * 
 * Inspiré d'autonovel : cette automation est identifiée comme
 * un "gap clé" dans leur PIPELINE.md
 */
export class RevisionBriefGenerator {
  /**
   * Génère un brief de révision à partir d'une évaluation
   */
  generateBrief(evaluation: EssayEvaluation, unit: DraftUnit): RevisionBrief {
    // Identifier les zones de focus prioritaires
    const focusAreas = this.identifyFocusAreas(evaluation);

    // Générer les instructions spécifiques
    const specificInstructions = this.generateInstructions(evaluation);

    // Créer le brief
    const brief = createRevisionBrief(
      unit.id,
      "", // Sera rempli par l'appelant
      focusAreas,
      specificInstructions
    );

    // Enrichir avec les détails
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

    return brief;
  }

  /**
   * Identifie les zones de focus prioritaires
   */
  private identifyFocusAreas(
    evaluation: EssayEvaluation
  ): RevisionBrief["focusAreas"] {
    // Trier les dimensions par score croissant
    const dimensions = [
      { dim: "claimSupport", score: evaluation.dimensions.claimSupport },
      { dim: "citationIntegrity", score: evaluation.dimensions.citationIntegrity },
      { dim: "counterargumentQuality", score: evaluation.dimensions.counterargumentQuality },
      { dim: "transitionClarity", score: evaluation.dimensions.transitionClarity },
      { dim: "scopeControl", score: evaluation.dimensions.scopeControl },
      { dim: "voiceConsistency", score: evaluation.dimensions.voiceConsistency },
    ].sort((a, b) => a.score - b.score);

    // Prendre les 3 plus faibles
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

    // Instructions basées sur le verdict
    switch (evaluation.verdict) {
      case "keep":
        instructions.push("Aucune révision nécessaire.");
        break;
      case "keep_with_minor_edits":
        instructions.push("Révisions mineures demandées.");
        break;
      case "revise":
        instructions.push("Révision substantielle requise.");
        break;
      case "discard":
        instructions.push("Reprise complète nécessaire.");
        break;
    }

    // Instructions des top 3 révisions
    for (const rev of evaluation.top3Revisions) {
      instructions.push(`${rev.priority}. ${rev.target}: ${rev.approach}`);
    }

    // Instructions sur les sur-assertions
    if (evaluation.overclaimRisks.length > 0) {
      instructions.push(
        `Corriger ${evaluation.overclaimRisks.length} sur-assertion(s)`
      );
    }

    // Instructions sur les gaps de preuve
    if (evaluation.evidenceGaps.length > 0) {
      instructions.push(
        `Ajouter des preuves pour ${evaluation.evidenceGaps.length} affirmation(s)`
      );
    }

    return instructions;
  }

  /**
   * Retourne une description pour une zone de focus
   * @deprecated - Cette methode devrait etre utilisee
   */
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

/**
 * Factory pour créer un générateur de briefs
 */
export function createRevisionBriefGenerator(): RevisionBriefGenerator {
  return new RevisionBriefGenerator();
}
