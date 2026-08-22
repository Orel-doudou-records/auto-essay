import { z } from "zod";
import type { StructuredModelClient } from "../evaluation/evaluateEssay";
import type { Claim } from "../domain/claim";
import type { Concept } from "../domain/concept";
import type { Source } from "../domain/source";
import type { Tension } from "../domain/tension";
import {
  ContentRelationParticipantSchema,
  ContentRelationTypeSchema,
  EditorialScopeSchema,
  createContentRelation,
  type ContentRelation,
  type ContentRelationParticipant,
  type EditorialScopeInput,
} from "../domain/contentRelation";

const RawContentRelationSchema = z.object({
  type: ContentRelationTypeSchema,
  participants: z.array(ContentRelationParticipantSchema).min(1),
  description: z.string().min(1),
  evidenceIds: z.array(z.string().min(1)).default([]),
  confidence: z.enum(["low", "medium", "high"]).default("medium"),
});

const RelationAnalysisOutputSchema = z.object({
  relations: z.array(RawContentRelationSchema).default([]),
});

export interface RelationAnalysisRequest {
  scope: EditorialScopeInput;
  sources: Source[];
  claims: Claim[];
  argumentativeFunction?: string;
  objections?: Array<{
    statement: string;
    sourceId?: string;
  }>;
  concepts?: Concept[];
  tensions?: Tension[];
  unitIds?: string[];
}

/**
 * Produit des relations explicites sans modifier les sources ni les claims.
 * Les relations certaines sont d'abord dérivées mécaniquement, puis complétées
 * par un modèle structuré lorsqu'un client est fourni.
 */
export class RelationAnalyzer {
  constructor(private readonly client?: StructuredModelClient) {}

  async analyze(request: RelationAnalysisRequest): Promise<ContentRelation[]> {
    const scope = EditorialScopeSchema.parse(request.scope);
    const deterministicRelations = detectDeterministicRelations(request, scope);

    if (!this.client) {
      return deterministicRelations;
    }

    const rawOutput = await this.client.generateJson(
      buildRelationAnalysisPrompt(request)
    );
    const parsed = RelationAnalysisOutputSchema.parse(rawOutput);
    const catalog = buildParticipantCatalog(request);

    const modelRelations = parsed.relations.map((rawRelation, index) => {
      assertKnownParticipants(rawRelation.participants, catalog, index);
      assertKnownEvidence(rawRelation.evidenceIds, catalog, index);

      return createContentRelation({
        scope,
        ...rawRelation,
        origin: "system_detected",
        status: "detected",
      });
    });

    return deduplicateRelations([
      ...deterministicRelations,
      ...modelRelations,
    ]);
  }
}

export function createRelationAnalyzer(
  client?: StructuredModelClient
): RelationAnalyzer {
  return new RelationAnalyzer(client);
}

export function buildRelationAnalysisPrompt(
  request: RelationAnalysisRequest
): string {
  const payload = {
    scope: request.scope,
    argumentativeFunction: request.argumentativeFunction,
    sources: request.sources.map((source) => ({
      id: source.id,
      title: source.title,
      regime: source.regime,
      verificationStatus: source.verificationStatus,
      epistemicLimits: source.epistemicLimits,
      content: source.content.slice(0, 2000),
    })),
    claims: request.claims.map((claim) => ({
      id: claim.id,
      statement: claim.statement,
      claimType: claim.claimType,
      confidenceLevel: claim.confidenceLevel,
      sourceIds: claim.sourceIds,
      contradictionOf: claim.contradictionOf,
      status: claim.status,
    })),
    objections: request.objections ?? [],
    concepts: (request.concepts ?? []).map((concept) => ({
      id: concept.id,
      label: concept.label,
      definition: concept.definition,
    })),
    tensions: (request.tensions ?? []).map((tension) => ({
      id: tension.id,
      label: tension.label,
      description: tension.description,
    })),
    unitIds: request.unitIds ?? [],
  };

  return `Tu analyses les relations documentaires et argumentatives d'une unité d'essai.

Tu ne réécris aucune source et aucun claim. Tu dois uniquement décrire les relations déjà soutenues par les objets fournis.

## Données
\`\`\`json
${JSON.stringify(payload, null, 2)}
\`\`\`

## Relations disponibles
- supports : un participant soutient explicitement un autre
- contradicts : incompatibilité portant sur le même objet et le même périmètre
- qualifies : limitation, précision ou modalisation
- reframes : changement du cadre d'interprétation
- silences : absence documentaire significative et justifiable
- translates : passage entre vocabulaires ou régimes
- appropriates : reprise qui déplace l'autorité ou la propriété d'une formulation
- changes_scale : passage entre échelles
- changes_temporality : passage entre temporalités
- changes_source_regime : passage entre régimes documentaires
- differs_in_scope : écart de périmètre qui ne constitue pas une contradiction

## Discipline
- N'utilise que les identifiants fournis.
- Une contradiction exige un objet et un périmètre comparables.
- Une différence de périmètre doit être classée \`differs_in_scope\`, pas \`contradicts\`.
- Un silence peut avoir un seul participant, mais sa description doit préciser ce qui manque et pourquoi l'absence compte.
- N'infère pas qu'une source est supérieure à une autre à partir de son régime.
- Retourne zéro relation supplémentaire lorsque les données ne les soutiennent pas.

## Format JSON strict
{
  "relations": [
    {
      "type": "supports|contradicts|qualifies|reframes|silences|translates|appropriates|changes_scale|changes_temporality|changes_source_regime|differs_in_scope",
      "participants": [
        {
          "kind": "source|claim|concept|tension|unit",
          "id": "identifiant fourni",
          "role": "rôle optionnel dans la relation"
        }
      ],
      "description": "relation précise et vérifiable",
      "evidenceIds": ["identifiant fourni"],
      "confidence": "low|medium|high"
    }
  ]
}`;
}

function detectDeterministicRelations(
  request: RelationAnalysisRequest,
  scope: ReturnType<typeof EditorialScopeSchema.parse>
): ContentRelation[] {
  const sourceIds = new Set(request.sources.map((source) => source.id));
  const claimsById = new Map(request.claims.map((claim) => [claim.id, claim]));
  const relations: ContentRelation[] = [];

  for (const claim of request.claims) {
    for (const sourceId of claim.sourceIds) {
      if (!sourceIds.has(sourceId)) {
        continue;
      }

      relations.push(
        createContentRelation({
          scope,
          type: "supports",
          participants: [
            { kind: "source", id: sourceId, role: "supporting_source" },
            { kind: "claim", id: claim.id, role: "supported_claim" },
          ],
          description: `Source ${sourceId} is recorded as supporting claim ${claim.id}`,
          evidenceIds: [sourceId],
          confidence: "high",
          origin: "system_detected",
          status: "detected",
        })
      );
    }

    if (claim.contradictionOf) {
      const contradictedClaim = claimsById.get(claim.contradictionOf);

      if (contradictedClaim) {
        relations.push(
          createContentRelation({
            scope,
            type: "contradicts",
            participants: [
              { kind: "claim", id: claim.id, role: "challenging_claim" },
              {
                kind: "claim",
                id: contradictedClaim.id,
                role: "challenged_claim",
              },
            ],
            description: `Claim ${claim.id} is explicitly recorded as contradicting claim ${contradictedClaim.id}`,
            evidenceIds: Array.from(
              new Set([...claim.sourceIds, ...contradictedClaim.sourceIds])
            ),
            confidence: "high",
            origin: "system_detected",
            status: "detected",
          })
        );
      }
    }
  }

  return deduplicateRelations(relations);
}

function buildParticipantCatalog(
  request: RelationAnalysisRequest
): Map<ContentRelationParticipant["kind"], Set<string>> {
  return new Map([
    ["source", new Set(request.sources.map((source) => source.id))],
    ["claim", new Set(request.claims.map((claim) => claim.id))],
    ["concept", new Set((request.concepts ?? []).map((concept) => concept.id))],
    ["tension", new Set((request.tensions ?? []).map((tension) => tension.id))],
    ["unit", new Set(request.unitIds ?? [])],
  ]);
}

function assertKnownParticipants(
  participants: ContentRelationParticipant[],
  catalog: Map<ContentRelationParticipant["kind"], Set<string>>,
  relationIndex: number
): void {
  for (const participant of participants) {
    if (!catalog.get(participant.kind)?.has(participant.id)) {
      throw new Error(
        `Relation ${relationIndex} references unknown ${participant.kind} ${participant.id}`
      );
    }
  }
}

function assertKnownEvidence(
  evidenceIds: string[],
  catalog: Map<ContentRelationParticipant["kind"], Set<string>>,
  relationIndex: number
): void {
  const knownIds = new Set(
    Array.from(catalog.values()).flatMap((ids) => Array.from(ids))
  );

  for (const evidenceId of evidenceIds) {
    if (!knownIds.has(evidenceId)) {
      throw new Error(
        `Relation ${relationIndex} references unknown evidence ${evidenceId}`
      );
    }
  }
}

function deduplicateRelations(relations: ContentRelation[]): ContentRelation[] {
  const seen = new Set<string>();

  return relations.filter((relation) => {
    const participants = relation.participants
      .map((participant) => `${participant.kind}:${participant.id}`)
      .sort()
      .join("|");
    const key = `${relation.type}:${participants}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
