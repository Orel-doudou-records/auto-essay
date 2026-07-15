import { z } from "zod";
import type { StructuredModelClient } from "../evaluation/evaluateEssay";
import {
  ObservationContentConfigurationSchema,
  ObservedEffectsSchema,
  ObservedStylisticOperationSchema,
  ObservationEvidenceSchema,
  StyleObservationSchema,
  type ObservationEvidence,
  type StyleObservation,
} from "../domain/styleObservation";

const RawStyleObservationSchema = z.object({
  contentConfiguration: ObservationContentConfigurationSchema,
  formalOperations: z.array(ObservedStylisticOperationSchema).min(1),
  observedEffects: ObservedEffectsSchema,
  evidence: ObservationEvidenceSchema,
  confidence: z.enum(["low", "medium", "high"]),
  maturity: z
    .enum(["single_observation", "recurring_pattern", "validated_practice"])
    .default("single_observation"),
  notes: z.array(z.string().min(1)).default([]),
});

const ObservationAnalysisOutputSchema = z.object({
  observations: z.array(RawStyleObservationSchema).default([]),
});

export interface ObservationAnalysisRequest {
  authorId: string;
  sourceTextId: string;
  sourceText: string;
  sourceLabel?: string;
  authorIntent?: string;
  audience?: string;
  constraints?: string[];
}

/**
 * Analyse un texte de référence en observations relationnelles localisées.
 * Le service ne produit ni profil global ni signature stable.
 */
export class ObservationAnalyzer {
  constructor(private readonly client: StructuredModelClient) {}

  async analyze(request: ObservationAnalysisRequest): Promise<StyleObservation[]> {
    if (request.sourceText.trim().length === 0) {
      return [];
    }

    const rawOutput = await this.client.generateJson(
      buildObservationAnalysisPrompt(request)
    );
    const parsed = ObservationAnalysisOutputSchema.parse(rawOutput);

    return parsed.observations.map((rawObservation, index) => {
      assertEvidenceGrounded(
        rawObservation.evidence,
        request.sourceText,
        index
      );

      const { notes, ...observation } = rawObservation;

      return StyleObservationSchema.parse({
        id: crypto.randomUUID(),
        authorId: request.authorId,
        sourceTextId: request.sourceTextId,
        ...observation,
        provenance: {
          origin: "author_text_analysis",
          notes,
        },
        createdAt: new Date().toISOString(),
      });
    });
  }
}

export function createObservationAnalyzer(
  client: StructuredModelClient
): ObservationAnalyzer {
  return new ObservationAnalyzer(client);
}

export function buildObservationAnalysisPrompt(
  request: ObservationAnalysisRequest
): string {
  return `Tu analyses un passage comme une relation entre matière et écriture.

Tu ne produis pas un profil d'auteur, une signature globale ou une liste d'adjectifs. Tu identifies uniquement des opérations localisées dont le déclencheur dans le contenu, le mécanisme formel et l'effet sont observables dans le passage.

## Métadonnées
- Source : ${request.sourceLabel ?? request.sourceTextId}
- Intention déclarée : ${request.authorIntent ?? "non spécifiée"}
- Public : ${request.audience ?? "non spécifié"}
- Contraintes : ${(request.constraints ?? []).join(" ; ") || "aucune"}

## Passage
\`\`\`
${request.sourceText}
\`\`\`

## Familles disponibles
1. Énonciation et structure
2. Syntaxe, rythme et musicalité
3. Tonalité et lexique
4. Figuration, rhétorique et genre
5. Imperfections créatives

## Discipline
- Une observation doit décrire une configuration de contenu réelle.
- Une opération doit préciser son déclencheur, ce qu'elle fait et son effet local.
- Chaque observation doit citer un extrait exact du passage ou fournir des offsets valides.
- N'invente aucune catégorie pour remplir la taxonomie.
- Retourne zéro observation lorsque le passage ne permet pas une inférence suffisamment étayée.
- Une observation unique reste \`single_observation\`; ne la transforme pas en signature.

## Format JSON strict
{
  "observations": [
    {
      "contentConfiguration": {
        "argumentativeFunction": "string optionnel",
        "claimTypes": ["fact|interpretation|hypothesis|counterclaim|synthesis"],
        "sourceRegimes": ["institutional_archive|testimony|academic_study|artwork|dataset|criticism|personal_memory|promotional_communication|author_interpretation|journalistic_report|legal_document|other"],
        "relations": ["string"],
        "tensions": ["string"],
        "concepts": ["string"]
      },
      "formalOperations": [
        {
          "family": "enunciation_structure|syntax_rhythm_musicality|tone_lexicon|figuration_genre|creative_imperfection",
          "category": "une catégorie valide du schéma Literacraft",
          "trigger": "configuration précise qui déclenche l'opération",
          "operation": "mécanisme formel observé",
          "target": "section|paragraph|sentence_group|transition|source_voice|narrator_voice|lexical_network|figurative_system",
          "observedEffect": "effet local observable",
          "intensity": "subtle|moderate|structuring"
        }
      ],
      "observedEffects": {
        "argumentative": ["string"],
        "epistemic": ["string"],
        "emotional": ["string"],
        "reception": ["string"]
      },
      "evidence": {
        "excerpt": "extrait exact optionnel",
        "location": { "label": "string optionnel", "start": 0, "end": 10 }
      },
      "confidence": "low|medium|high",
      "maturity": "single_observation",
      "notes": ["limite ou précaution optionnelle"]
    }
  ]
}`;
}

function assertEvidenceGrounded(
  evidence: ObservationEvidence,
  sourceText: string,
  observationIndex: number
): void {
  if (evidence.excerpt !== undefined && !sourceText.includes(evidence.excerpt)) {
    throw new Error(
      `Observation ${observationIndex} cites an excerpt absent from the source text`
    );
  }

  const start = evidence.location?.start;
  const end = evidence.location?.end;

  if (start !== undefined && end !== undefined) {
    if (end > sourceText.length) {
      throw new Error(
        `Observation ${observationIndex} points outside the source text`
      );
    }

    if (
      evidence.excerpt !== undefined &&
      sourceText.slice(start, end) !== evidence.excerpt
    ) {
      throw new Error(
        `Observation ${observationIndex} excerpt does not match its offsets`
      );
    }
  }
}
