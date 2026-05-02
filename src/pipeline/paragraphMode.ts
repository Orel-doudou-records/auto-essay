import type { Source } from "../domain/source";
import type { EvidencePack } from "../domain/draftUnit";
import type { StructuredModelClient } from "../evaluation/evaluateEssay";

/**
 * Résultat de génération de paragraphe
 */
export interface ParagraphGenerationResult {
  content: string;
  plan: string[];
  claims: Array<{
    statement: string;
    confidenceLevel: "certain" | "probable" | "speculative" | "unsupported";
    sourceIds: string[];
  }>;
  confidenceAssessment: "high" | "medium" | "low";
}

/**
 * Générateur de paragraphes
 * Mode PARAGRAPHE : 120-250 mots, intégration de fragments
 */
export class ParagraphGenerator {
  private client: StructuredModelClient;

  constructor(client: StructuredModelClient) {
    this.client = client;
  }

  /**
   * Génère un paragraphe à partir d'un evidence pack
   */
  async generateParagraph(
    evidencePack: EvidencePack,
    sources: Source[],
    context?: {
      section?: string;
      precedingText?: string;
      thesis?: string;
    }
  ): Promise<ParagraphGenerationResult> {
    const prompt = this.buildParagraphPrompt(evidencePack, sources, context);
    const rawOutput = await this.client.generateJson(prompt);
    return this.parseParagraphOutput(rawOutput as Record<string, unknown>);
  }

  /**
   * Construit le prompt pour la génération de paragraphe
   */
  private buildParagraphPrompt(
    evidencePack: EvidencePack,
    sources: Source[],
    context?: {
      section?: string;
      precedingText?: string;
      thesis?: string;
    }
  ): string {
    // Formatter les sources
    const sourcesList = evidencePack.sourceIds
      .map((id) => sources.find((s) => s.id === id))
      .filter(Boolean)
      .map(
        (s) =>
          `- ${s!.title} (${s!.authors.join(", ")})\n  Citations clés:\n${s!.annotations
            .map((a) => `    - "${a.content}"${a.pageRange ? ` (p. ${a.pageRange})` : ""}`)
            .join("\n")}`
      )
      .join("\n\n");

    // Formatter les citations clés de l'evidence pack
    const keyCitations = evidencePack.keyCitations
      .map(
        (c) =>
          `- "${c.quote}"${c.pageRange ? ` (p. ${c.pageRange})` : ""}${c.context ? `\n  Contexte: ${c.context}` : ""}`
      )
      .join("\n");

    return `Tu travailles en mode PARAGRAPHE.

## Objectif
Intégrer les sources fournies dans un paragraphe cohérent de 180-220 mots, sans sur-interpréter.

${context?.thesis ? `## Thèse du projet\n${context.thesis}` : ""}
${context?.section ? `## Section\n${context.section}` : ""}
${context?.precedingText ? `## Texte précédent\n${context.precedingText}\n` : ""}

## Evidence Pack

### Sources
${sourcesList || "Aucune source"}

### Citations clés à intégrer
${keyCitations || "Aucune citation spécifiée"}

${evidencePack.authorNotes ? `### Notes de l'auteur\n${evidencePack.authorNotes}` : ""}

## Contraintes absolues
1. 180-220 mots exactement
2. Maximum 2 citations directes
3. Toutes les citations DOIVENT venir de l'evidence pack
4. Distinguer explicitement : fait / interprétation / hypothèse
5. Si une affirmation n'est pas prouvée, utiliser un verbe modal (suggère, indique, semble)
6. Pas d'assertion forte ("démontre", "prouve") sans source solide

## Format de sortie (JSON strict)
\`\`\`json
{
  "plan_3_sentences": ["string", "string", "string"],
  "paragraph": "string (180-220 mots)",
  "claims": [
    {
      "statement": "string",
      "confidenceLevel": "certain|probable|speculative|unsupported",
      "sourceIds": ["string"]
    }
  ],
  "confidence_assessment": "high|medium|low"
}
\`\`\`

Le plan_3_sentences doit décrire le mouvement du paragraphe en 3 phrases maximum.
Les claims doivent être des assertions factuelles extraites du paragraphe.
La confidence_assessment évalue la solidité globale du paragraphe.`;
  }

  /**
   * Parse la sortie de génération
   */
  private parseParagraphOutput(
    rawOutput: Record<string, unknown>
  ): ParagraphGenerationResult {
    const content = String(rawOutput.paragraph || "");
    const plan = Array.isArray(rawOutput.plan_3_sentences)
      ? rawOutput.plan_3_sentences.map(String)
      : [];
    const claims = Array.isArray(rawOutput.claims)
      ? rawOutput.claims.map((c: unknown) => {
          const claim = c as Record<string, unknown>;
          return {
            statement: String(claim.statement || ""),
            confidenceLevel: (claim.confidenceLevel as
              | "certain"
              | "probable"
              | "speculative"
              | "unsupported") || "unsupported",
            sourceIds: Array.isArray(claim.sourceIds)
              ? claim.sourceIds.map(String)
              : [],
          };
        })
      : [];
    const confidenceAssessment = (rawOutput.confidence_assessment as
      | "high"
      | "medium"
      | "low") || "low";

    return {
      content,
      plan,
      claims,
      confidenceAssessment,
    };
  }
}

/**
 * Factory pour créer un générateur de paragraphes
 */
export function createParagraphGenerator(
  client: StructuredModelClient
): ParagraphGenerator {
  return new ParagraphGenerator(client);
}
