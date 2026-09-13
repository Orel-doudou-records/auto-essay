import { z } from "zod";
import type { IngestedDocument } from "../domain/ingestedDocument.js";
import type { SourceProfile } from "../domain/sourceProfile.js";
import type { StructuredModelClient } from "../evaluation/evaluateEssay.js";
import { assessComprehensionClosure } from "./bibliography.js";
import {
  createCorpusExplorer,
  type CorpusLocator,
  type RetrievedPassage,
} from "./corpusExplorer.js";

export const CorpusSynthesisObservationKindSchema = z.enum([
  "recurrence",
  "divergence",
  "contradiction",
  "definition_conflict",
  "scale_shift",
  "temporal_shift",
  "source_regime_shift",
  "singularity",
  "under_documented",
]);

export type CorpusSynthesisObservationKind = z.infer<
  typeof CorpusSynthesisObservationKindSchema
>;

export const CorpusSynthesisAnchorSchema = z.object({
  sourceId: z.string().min(1),
  blockId: z.string().min(1),
});
export type CorpusSynthesisAnchor = z.infer<typeof CorpusSynthesisAnchorSchema>;

export const CorpusSynthesisObservationSchema = z.object({
  id: z.string().min(1),
  kind: CorpusSynthesisObservationKindSchema,
  statement: z.string().min(1),
  sourceIds: z.array(z.string().min(1)).min(1),
  anchors: z.array(CorpusSynthesisAnchorSchema).min(1),
});
export type CorpusSynthesisObservation = z.infer<
  typeof CorpusSynthesisObservationSchema
>;

export const CorpusSynthesisSchema = z.object({
  sourceIds: z.array(z.string().min(1)).min(1),
  observations: z.array(CorpusSynthesisObservationSchema).min(1),
});
export type CorpusSynthesis = z.infer<typeof CorpusSynthesisSchema>;

const RawCorpusSynthesisSchema = z.object({
  observations: z.array(CorpusSynthesisObservationSchema).min(1),
});

export async function synthesizeClosedCorpus(input: {
  documents: IngestedDocument[];
  profiles: SourceProfile[];
  client: StructuredModelClient;
  excludedSourceIds?: string[];
}): Promise<CorpusSynthesis> {
  const excludedSourceIds = input.excludedSourceIds ?? [];
  const closure = assessComprehensionClosure(
    input.documents,
    input.profiles,
    excludedSourceIds
  );
  if (!closure.complete) {
    throw new Error(
      `Corpus synthesis requires comprehension closure; blocking sources: ${closure.blockingSourceIds.join(", ")}`
    );
  }

  const activeSourceIds = [...closure.readySourceIds].sort((a, b) => a.localeCompare(b));
  if (activeSourceIds.length === 0) {
    throw new Error("Corpus synthesis requires at least one active ready source");
  }

  const profileBySourceId = new Map(
    input.profiles.map((profile) => [profile.sourceId, profile] as const)
  );
  const activeProfiles = activeSourceIds.map((sourceId) => {
    const profile = profileBySourceId.get(sourceId);
    if (!profile) {
      throw new Error(`Missing ready SourceProfile for '${sourceId}'`);
    }
    return profile;
  });

  const raw = await input.client.generateJson(buildCorpusSynthesisPrompt(activeProfiles));
  const parsed = RawCorpusSynthesisSchema.parse(raw);
  validateSynthesisObservations(parsed.observations, activeProfiles);

  return CorpusSynthesisSchema.parse({
    sourceIds: activeSourceIds,
    observations: parsed.observations,
  });
}

export function buildCorpusSynthesisPrompt(profiles: SourceProfile[]): string {
  const ordered = [...profiles].sort((left, right) =>
    left.sourceId.localeCompare(right.sourceId)
  );
  const material = ordered
    .map((profile) => {
      const sections = (profile.sections ?? [])
        .map((section) => {
          const path =
            section.sectionPath.length > 0
              ? section.sectionPath.join(" > ")
              : "racine";
          return `  - section=${path} blocks=${section.blockIds.join(",")}\n    ${section.synopsis}`;
        })
        .join("\n");
      return `SOURCE ${profile.sourceId}\nabstract=${profile.abstract ?? ""}\nsubjects=${profile.subjects.join(", ")}\nconcepts=${profile.concepts.join(", ")}\n${sections}`;
    })
    .join("\n\n");

  return `Compare l'ensemble FERME de SourceProfiles ci-dessous afin d'identifier des observations comparatives utiles à la découverte d'un sujet de livre.

Règles impératives :
- utilise uniquement les informations fournies ; aucune connaissance générale ;
- considère toutes les sources, indépendamment de leur ordre d'entrée ;
- ne confonds jamais fréquence et importance : une singularité d'une seule source peut être décisive ;
- recherche explicitement récurrences, divergences, contradictions, définitions incompatibles, changements d'échelle, de temporalité ou de régime de source, singularités et zones sous-documentées ;
- chaque observation doit citer les sourceId participantes ;
- chaque sourceId participante doit posséder au moins un anchor {sourceId, blockId} provenant des sections fournies ;
- les anchors servent seulement à redescendre vers le document canonique : ils ne constituent pas encore une preuve ;
- n'invente jamais de sourceId ou blockId.

Corpus fermé :
${material}

JSON strict attendu :
{"observations":[{"id":"obs-1","kind":"recurrence|divergence|contradiction|definition_conflict|scale_shift|temporal_shift|source_regime_shift|singularity|under_documented","statement":"...","sourceIds":["..."],"anchors":[{"sourceId":"...","blockId":"..."}]}]}`;
}

export async function materializeCorpusSynthesis(input: {
  synthesis: CorpusSynthesis;
  documents: IngestedDocument[];
}): Promise<{
  passages: RetrievedPassage[];
  coverage: {
    anchorCount: number;
    materializedAnchorCount: number;
    complete: boolean;
  };
}> {
  const active = new Set(input.synthesis.sourceIds);
  const documents = input.documents.filter((document) => active.has(document.sourceId));
  const bySourceId = new Map<string, IngestedDocument>();
  for (const document of documents) {
    if (bySourceId.has(document.sourceId)) {
      throw new Error(
        `Corpus synthesis materialization requires one active document per source; duplicate '${document.sourceId}'`
      );
    }
    bySourceId.set(document.sourceId, document);
  }

  const uniqueAnchors: CorpusSynthesisAnchor[] = [];
  const seen = new Set<string>();
  for (const observation of input.synthesis.observations) {
    for (const anchor of observation.anchors) {
      const key = `${anchor.sourceId}:${anchor.blockId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      uniqueAnchors.push(anchor);
    }
  }

  const passages: RetrievedPassage[] = [];
  for (let start = 0; start < uniqueAnchors.length; start += 100) {
    const batch = uniqueAnchors.slice(start, start + 100);
    const locator: CorpusLocator = async () =>
      batch.map((anchor) => {
        const document = bySourceId.get(anchor.sourceId);
        if (!document) {
          throw new Error(`No active IngestedDocument for synthesis source '${anchor.sourceId}'`);
        }
        return {
          documentId: document.id,
          blockId: anchor.blockId,
          reason: "corpus-synthesis-anchor",
        };
      });
    const explorer = createCorpusExplorer(documents, locator);
    passages.push(
      ...(await explorer.retrieve({
        mode: "exploration",
        query: `corpus-synthesis-anchor-batch-${start / 100}`,
        limit: batch.length,
      }))
    );
  }

  const materialized = new Set(
    passages.map((passage) => `${passage.sourceId}:${passage.span.blockId}`)
  );
  const complete = uniqueAnchors.every((anchor) =>
    materialized.has(`${anchor.sourceId}:${anchor.blockId}`)
  );

  return {
    passages,
    coverage: {
      anchorCount: uniqueAnchors.length,
      materializedAnchorCount: materialized.size,
      complete,
    },
  };
}

function validateSynthesisObservations(
  observations: CorpusSynthesisObservation[],
  profiles: SourceProfile[]
): void {
  const profileBySourceId = new Map(
    profiles.map((profile) => [profile.sourceId, profile] as const)
  );
  const blockIdsBySourceId = new Map(
    profiles.map((profile) => [
      profile.sourceId,
      new Set((profile.sections ?? []).flatMap((section) => section.blockIds)),
    ] as const)
  );

  for (const observation of observations) {
    const participants = new Set(observation.sourceIds);
    if (participants.size !== observation.sourceIds.length) {
      throw new Error(`Corpus synthesis observation '${observation.id}' repeats a sourceId`);
    }
    for (const sourceId of participants) {
      if (!profileBySourceId.has(sourceId)) {
        throw new Error(
          `Corpus synthesis observation '${observation.id}' references unknown source '${sourceId}'`
        );
      }
      if (!observation.anchors.some((anchor) => anchor.sourceId === sourceId)) {
        throw new Error(
          `Corpus synthesis observation '${observation.id}' lacks an anchor for source '${sourceId}'`
        );
      }
    }

    for (const anchor of observation.anchors) {
      if (!participants.has(anchor.sourceId)) {
        throw new Error(
          `Corpus synthesis observation '${observation.id}' anchors non-participant source '${anchor.sourceId}'`
        );
      }
      if (!blockIdsBySourceId.get(anchor.sourceId)?.has(anchor.blockId)) {
        throw new Error(
          `Corpus synthesis observation '${observation.id}' references unknown block '${anchor.blockId}' for source '${anchor.sourceId}'`
        );
      }
    }
  }
}
