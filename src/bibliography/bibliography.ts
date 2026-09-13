import { z } from "zod";
import type { StructuredModelClient } from "../evaluation/evaluateEssay";
import type { Source } from "../domain/index";
import type { IngestedBlock, IngestedDocument } from "../domain/ingestedDocument";
import {
  SourceProfileSchema,
  type SourceProfile,
  type SourceProfileSection,
} from "../domain/sourceProfile";

/** Index bibliographique persistant : sources + profils sémantiques dérivés. */
export const LibrarySchema = z.object({
  sources: z.array(z.unknown()),
  profiles: z.array(SourceProfileSchema).default([]),
});

export type Library = z.infer<typeof LibrarySchema>;

const SectionSynopsisSchema = z.object({
  synopsis: z.string().min(1),
});

const DocumentProfileOutputSchema = z.object({
  subjects: z.array(z.string().min(1)).default([]),
  concepts: z.array(z.string().min(1)).default([]),
  abstract: z.string().min(1).optional(),
});

export interface BuildProfilesOptions {
  /** Nombre maximum de blocs envoyés dans une passe locale (défaut 20). */
  maxBlocksPerBatch?: number;
  /** Blocs volontairement exclus, indexés par IngestedDocument.id. */
  excludedBlockIdsByDocumentId?: Record<string, string[]>;
}

interface SectionGroup {
  sectionPath: string[];
  blocks: IngestedBlock[];
}

/**
 * Construit un profil depuis le contenu réellement ingéré.
 * Chaque bloc non exclu contribue à une synthèse de section avant la synthèse
 * globale du document. Les lots sont transitoires et ne deviennent aucun objet
 * canonique.
 */
export async function buildProfiles(
  documents: IngestedDocument[],
  client: StructuredModelClient,
  options: BuildProfilesOptions = {}
): Promise<SourceProfile[]> {
  const maxBlocksPerBatch = Math.max(1, options.maxBlocksPerBatch ?? 20);
  const profiles: SourceProfile[] = [];

  for (const document of documents) {
    const excludedBlockIds = new Set(
      options.excludedBlockIdsByDocumentId?.[document.id] ?? []
    );
    const knownBlockIds = new Set(document.blocks.map((block) => block.id));
    for (const blockId of excludedBlockIds) {
      if (!knownBlockIds.has(blockId)) {
        throw new Error(
          `Cannot exclude unknown block '${blockId}' from document '${document.id}'`
        );
      }
    }

    if (document.ingestionStatus === "unreadable" || document.blocks.length === 0) {
      profiles.push(
        SourceProfileSchema.parse({
          sourceId: document.sourceId,
          fingerprint: document.fingerprint,
          subjects: [],
          concepts: [],
          sections: [],
          comprehension: {
            totalBlocks: document.blocks.length,
            coveredBlockIds: [],
            excludedBlockIds: [...excludedBlockIds],
            status: "unreadable",
          },
        })
      );
      continue;
    }

    const includedBlocks = document.blocks.filter(
      (block) => !excludedBlockIds.has(block.id)
    );
    const sectionGroups = groupBlocksBySection(includedBlocks);
    const sections: SourceProfileSection[] = [];

    for (const group of sectionGroups) {
      const partialSynopses: string[] = [];
      for (let start = 0; start < group.blocks.length; start += maxBlocksPerBatch) {
        const batch = group.blocks.slice(start, start + maxBlocksPerBatch);
        const raw = await client.generateJson(
          buildSectionSynopsisPrompt(document, group.sectionPath, batch)
        );
        partialSynopses.push(SectionSynopsisSchema.parse(raw).synopsis);
      }

      if (partialSynopses.length === 0) continue;
      const synopsis =
        partialSynopses.length === 1
          ? partialSynopses[0]
          : SectionSynopsisSchema.parse(
              await client.generateJson(
                buildSectionReductionPrompt(group.sectionPath, partialSynopses)
              )
            ).synopsis;

      sections.push({
        sectionPath: [...group.sectionPath],
        synopsis,
        blockIds: group.blocks.map((block) => block.id),
      });
    }

    const coveredBlockIds = sections.flatMap((section) => section.blockIds);
    const accountedCount = coveredBlockIds.length + excludedBlockIds.size;
    const status =
      document.ingestionStatus === "ready" && accountedCount === document.blocks.length
        ? "ready"
        : "degraded";

    const profileOutput =
      sections.length > 0
        ? DocumentProfileOutputSchema.parse(
            await client.generateJson(
              buildDocumentProfilePrompt(document.sourceId, sections)
            )
          )
        : { subjects: [], concepts: [], abstract: undefined };

    profiles.push(
      SourceProfileSchema.parse({
        sourceId: document.sourceId,
        fingerprint: document.fingerprint,
        ...profileOutput,
        sections,
        comprehension: {
          totalBlocks: document.blocks.length,
          coveredBlockIds,
          excludedBlockIds: [...excludedBlockIds],
          status,
        },
      })
    );
  }

  return profiles;
}

export function buildSectionSynopsisPrompt(
  document: IngestedDocument,
  sectionPath: string[],
  blocks: IngestedBlock[]
): string {
  const path = sectionPath.length > 0 ? sectionPath.join(" > ") : "racine";
  const material = blocks
    .map(
      (block) =>
        `[${block.id}] locator=${block.locator.kind}:${block.locator.value}\n${block.text}`
    )
    .join("\n\n");

  return `Résume uniquement la matière documentaire fournie pour la section « ${path} » de la source ${document.sourceId}.

Règles impératives :
- n'utilise aucune connaissance générale ;
- n'invente aucun fait absent des blocs ;
- conserve désaccords, nuances et limites visibles ;
- ne transforme pas une hypothèse du document en fait externe.

Blocs :
${material}

JSON strict attendu : {"synopsis":"..."}`;
}

export function buildSectionReductionPrompt(
  sectionPath: string[],
  partialSynopses: string[]
): string {
  const path = sectionPath.length > 0 ? sectionPath.join(" > ") : "racine";
  const material = partialSynopses
    .map((synopsis, index) => `[lot-${index + 1}] ${synopsis}`)
    .join("\n");

  return `Fusionne les synopsis partiels de la section « ${path} » sans ajouter de connaissance externe.
Préserve les nuances, contradictions et limites. N'ajoute aucun fait absent des synopsis.

${material}

JSON strict attendu : {"synopsis":"..."}`;
}

export function buildDocumentProfilePrompt(
  sourceId: string,
  sections: SourceProfileSection[]
): string {
  const material = sections
    .map((section, index) => {
      const path =
        section.sectionPath.length > 0
          ? section.sectionPath.join(" > ")
          : "racine";
      return `[section-${index + 1}] ${path} | blocks=${section.blockIds.join(",")}\n${section.synopsis}`;
    })
    .join("\n\n");

  return `Construis le profil sémantique de la source ${sourceId} uniquement à partir des synopsis de sections ci-dessous.

Règles impératives :
- aucune connaissance générale ou bibliographique externe ;
- subjects : thèmes réellement présents ;
- concepts : notions réellement présentes ;
- abstract : synthèse fidèle du document, sans lisser les tensions importantes.

${material}

JSON strict attendu :
{"subjects":["..."],"concepts":["..."],"abstract":"..."}`;
}

function groupBlocksBySection(blocks: IngestedBlock[]): SectionGroup[] {
  const groups = new Map<string, SectionGroup>();
  for (const block of [...blocks].sort((a, b) => a.order - b.order)) {
    const key = JSON.stringify(block.sectionPath);
    const existing = groups.get(key);
    if (existing) {
      existing.blocks.push(block);
    } else {
      groups.set(key, {
        sectionPath: [...block.sectionPath],
        blocks: [block],
      });
    }
  }
  return [...groups.values()];
}

export function assessComprehensionClosure(
  documents: IngestedDocument[],
  profiles: SourceProfile[],
  explicitlyExcludedSourceIds: string[] = []
): {
  readySourceIds: string[];
  blockingSourceIds: string[];
  excludedSourceIds: string[];
  complete: boolean;
} {
  const excluded = new Set(explicitlyExcludedSourceIds);
  const knownSourceIds = new Set(documents.map((document) => document.sourceId));
  for (const sourceId of excluded) {
    if (!knownSourceIds.has(sourceId)) {
      throw new Error(`Cannot exclude unknown source '${sourceId}' from comprehension closure`);
    }
  }

  const profileBySourceId = new Map(
    profiles.map((profile) => [profile.sourceId, profile] as const)
  );
  const readySourceIds: string[] = [];
  const blockingSourceIds: string[] = [];
  const excludedSourceIds: string[] = [];

  for (const document of documents) {
    if (excluded.has(document.sourceId)) {
      excludedSourceIds.push(document.sourceId);
      continue;
    }

    const profile = profileBySourceId.get(document.sourceId);
    const ready = Boolean(
      document.ingestionStatus === "ready" &&
        profile?.fingerprint === document.fingerprint &&
        profile.comprehension?.status === "ready"
    );

    if (ready) readySourceIds.push(document.sourceId);
    else blockingSourceIds.push(document.sourceId);
  }

  return {
    readySourceIds,
    blockingSourceIds,
    excludedSourceIds,
    complete: blockingSourceIds.length === 0,
  };
}

export function selectDocumentsNeedingProfiles(
  documents: IngestedDocument[],
  profiles: SourceProfile[]
): IngestedDocument[] {
  const profileBySourceId = new Map(
    profiles.map((profile) => [profile.sourceId, profile] as const)
  );
  return documents.filter(
    (document) => profileBySourceId.get(document.sourceId)?.fingerprint !== document.fingerprint
  );
}

export function createLibrary(sources: Source[]): Library {
  return { sources: [...sources], profiles: [] };
}

export function mergeLibraryProfiles(
  library: Library,
  newProfiles: SourceProfile[]
): Library {
  const byId = new Map<string, SourceProfile>();
  for (const profile of library.profiles) byId.set(profile.sourceId, profile);
  for (const profile of newProfiles) byId.set(profile.sourceId, profile);
  return { ...library, profiles: [...byId.values()] };
}

/** Compatibilité legacy : sélectionne les sources sans aucun profil. */
export function selectUnprofiled(
  sources: Source[],
  profiles: SourceProfile[]
): Source[] {
  const known = new Set(profiles.map((profile) => profile.sourceId));
  return sources.filter((source) => !known.has(source.id));
}
