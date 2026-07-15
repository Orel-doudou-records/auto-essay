import { z } from "zod";
import type { StructuredModelClient } from "../evaluation/evaluateEssay";
import {
  ArticulationEffectsSchema,
  EditorialAlternativeSchema,
  EditorialRiskSchema,
  PlannedStylisticOperationSchema,
  createContentStyleArticulation,
  type ContentStyleArticulation,
} from "../domain/contentStyleArticulation";
import {
  EditorialScopeSchema,
  type ContentRelation,
  type EditorialScopeInput,
} from "../domain/contentRelation";
import type { StyleObservation } from "../domain/styleObservation";

const RawArticulationCandidateSchema = z.object({
  contentRelationIds: z.array(z.string().min(1)).min(1),
  supportingObservationIds: z.array(z.string().min(1)).default([]),
  stylisticOperations: z.array(PlannedStylisticOperationSchema).min(1),
  intendedEffects: ArticulationEffectsSchema,
  support: z.object({
    level: z.enum(["weak", "moderate", "strong"]),
    rationale: z.string().min(1),
  }),
  risks: z.array(EditorialRiskSchema).default([]),
  alternatives: z.array(EditorialAlternativeSchema).default([]),
});

const ArticulationResolutionOutputSchema = z.object({
  candidates: z.array(RawArticulationCandidateSchema).default([]),
});

export interface ArticulationResolutionRequest {
  scope: EditorialScopeInput;
  relations: ContentRelation[];
  observations: StyleObservation[];
  projectContext: string;
  argumentativeFunction: string;
  constraints?: string[];
  maxCandidates?: number;
}

/**
 * Met en relation les pratiques observées et la matière documentaire.
 * Toutes les sorties restent candidates et exigent une validation auteur.
 */
export class ArticulationResolver {
  constructor(private readonly client: StructuredModelClient) {}

  async resolve(
    request: ArticulationResolutionRequest
  ): Promise<ContentStyleArticulation[]> {
    if (request.relations.length === 0) {
      return [];
    }

    const scope = EditorialScopeSchema.parse(request.scope);
    assertProjectConsistency(request.relations, request.observations, scope.projectId);

    const maxCandidates = Math.max(1, Math.min(request.maxCandidates ?? 3, 5));
    const rawOutput = await this.client.generateJson(
      buildArticulationResolutionPrompt(request, maxCandidates)
    );
    const parsed = ArticulationResolutionOutputSchema.parse(rawOutput);
    const knownRelationIds = new Set(request.relations.map((relation) => relation.id));
    const knownObservationIds = new Set(
      request.observations.map((observation) => observation.id)
    );

    return parsed.candidates.slice(0, maxCandidates).map((candidate, index) => {
      assertKnownIds(
        candidate.contentRelationIds,
        knownRelationIds,
        "relation",
        index
      );
      assertKnownIds(
        candidate.supportingObservationIds,
        knownObservationIds,
        "observation",
        index
      );
      assertSupportCoherence(
        candidate.support.level,
        candidate.supportingObservationIds.length,
        index
      );

      return createContentStyleArticulation({
        scope,
        contentRelationIds: candidate.contentRelationIds,
        supportingObservationIds: candidate.supportingObservationIds,
        stylisticOperations: candidate.stylisticOperations,
        intendedEffects: candidate.intendedEffects,
        support: {
          ...candidate.support,
          matchedObservationCount: candidate.supportingObservationIds.length,
        },
        risks: candidate.risks,
        alternatives: candidate.alternatives,
        origin: "system_proposed",
        status: "candidate",
      });
    });
  }
}

export function createArticulationResolver(
  client: StructuredModelClient
): ArticulationResolver {
  return new ArticulationResolver(client);
}

export function buildArticulationResolutionPrompt(
  request: ArticulationResolutionRequest,
  maxCandidates: number = 3
): string {
  const payload = {
    scope: request.scope,
    projectContext: request.projectContext,
    argumentativeFunction: request.argumentativeFunction,
    constraints: request.constraints ?? [],
    relations: request.relations.map((relation) => ({
      id: relation.id,
      type: relation.type,
      participants: relation.participants,
      description: relation.description,
      confidence: relation.confidence,
      status: relation.status,
    })),
    observations: request.observations.map((observation) => ({
      id: observation.id,
      contentConfiguration: observation.contentConfiguration,
      formalOperations: observation.formalOperations,
      observedEffects: observation.observedEffects,
      confidence: observation.confidence,
      maturity: observation.maturity,
    })),
  };

  return `Tu proposes des articulations situées entre la matière d'un essai et des pratiques d'écriture observées.

Tu ne construis pas un profil d'auteur et tu n'appliques aucun style comme preset. Une proposition n'est légitime que si une relation de contenu réelle et une fonction éditoriale précise justifient les opérations formelles proposées.

## Données
\`\`\`json
${JSON.stringify(payload, null, 2)}
\`\`\`

## Discipline
- Retourne au maximum ${maxCandidates} propositions.
- Chaque proposition doit référencer au moins une relation fournie.
- N'utilise que les identifiants fournis.
- Les observations sont des précédents possibles, jamais des autorités automatiques.
- Une proposition peut être faiblement soutenue ou ne citer aucune observation, mais elle doit alors être marquée \`weak\`.
- Une proposition \`strong\` exige au moins deux observations pertinentes.
- Décris séparément les effets sur le contenu et sur la forme.
- Signale les risques de simplification, d'homogénéisation ou d'imitation.
- Retourne zéro candidat lorsqu'une articulation serait décorative ou artificielle.
- Toutes les sorties restent des candidats non exécutables.

## Format JSON strict
{
  "candidates": [
    {
      "contentRelationIds": ["relation-id"],
      "supportingObservationIds": ["observation-id"],
      "stylisticOperations": [
        {
          "family": "enunciation_structure|syntax_rhythm_musicality|tone_lexicon|figuration_genre|creative_imperfection",
          "category": "catégorie valide",
          "operation": "opération située",
          "target": "section|paragraph|sentence_group|transition|source_voice|narrator_voice|lexical_network|figurative_system",
          "rationale": "pourquoi cette opération répond à la relation de contenu",
          "intensity": "subtle|moderate|structuring"
        }
      ],
      "intendedEffects": {
        "content": ["transformation attendue du traitement de la matière"],
        "form": ["transformation formelle attendue"],
        "argumentative": ["string"],
        "epistemic": ["string"],
        "emotional": ["string"],
        "reception": ["string"]
      },
      "support": {
        "level": "weak|moderate|strong",
        "rationale": "raison précise du niveau de soutien"
      },
      "risks": [
        {
          "description": "risque",
          "impact": "low|medium|high",
          "mitigation": "mesure optionnelle"
        }
      ],
      "alternatives": [
        {
          "description": "alternative",
          "tradeoffs": ["compromis"]
        }
      ]
    }
  ]
}`;
}

function assertKnownIds(
  ids: string[],
  knownIds: Set<string>,
  kind: "relation" | "observation",
  candidateIndex: number
): void {
  for (const id of ids) {
    if (!knownIds.has(id)) {
      throw new Error(
        `Articulation candidate ${candidateIndex} references unknown ${kind} ${id}`
      );
    }
  }
}

function assertSupportCoherence(
  level: "weak" | "moderate" | "strong",
  observationCount: number,
  candidateIndex: number
): void {
  if (level === "strong" && observationCount < 2) {
    throw new Error(
      `Articulation candidate ${candidateIndex} cannot be strongly supported with fewer than two observations`
    );
  }

  if (level === "moderate" && observationCount < 1) {
    throw new Error(
      `Articulation candidate ${candidateIndex} cannot be moderately supported without an observation`
    );
  }
}

function assertProjectConsistency(
  relations: ContentRelation[],
  observations: StyleObservation[],
  projectId: string
): void {
  const foreignRelation = relations.find(
    (relation) => relation.scope.projectId !== projectId
  );

  if (foreignRelation) {
    throw new Error(
      `Relation ${foreignRelation.id} belongs to another project`
    );
  }

  const duplicateObservationIds = new Set<string>();
  const seenObservationIds = new Set<string>();

  for (const observation of observations) {
    if (seenObservationIds.has(observation.id)) {
      duplicateObservationIds.add(observation.id);
    }
    seenObservationIds.add(observation.id);
  }

  if (duplicateObservationIds.size > 0) {
    throw new Error(
      `Duplicate observation identifiers: ${Array.from(duplicateObservationIds).join(", ")}`
    );
  }
}
