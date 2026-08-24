import { z } from "zod";
import type { StructuredModelClient } from "../evaluation/evaluateEssay";
import type { Source } from "../domain/index";
import {
  SourceProfileSchema,
  type SourceProfile,
} from "../domain/sourceProfile";

/** Index bibliographique persistant : les sources + leurs profils compacts. */
export const LibrarySchema = z.object({
  sources: z.array(z.unknown()), // Source[] vérifié par l'appelant (alphabétique ? non : ordre du corpus)
  profiles: z.array(SourceProfileSchema).default([]),
});

export type Library = z.infer<typeof LibrarySchema>;

const BatchProfilesSchema = z.object({
  profiles: z.array(SourceProfileSchema).default([]),
});

export interface BuildProfilesOptions {
  /** Nombre de sources par lot (défaut 20). */
  batchSize?: number;
}

/**
 * Prompt d'un lot : uniquement les métadonnées (jamais le contenu), pour tenir
 * le coût proportionnel au nombre de sources et non à leur taille.
 */
export function buildProfilesPrompt(sources: Source[]): string {
  const rows = sources
    .map((s) => {
      const authors = s.authors.length > 0 ? s.authors.join(", ") : "inconnu(s)";
      const year = s.doi ? ` (doi: ${s.doi})` : "";
      return `- ${s.id} | ${s.title} | ${authors}${year}`;
    })
    .join("\n");
  return `Propose pour chaque référence un profil sémantique compact en français :
- subjects : 2-4 sujets/thèmes généraux du document ;
- concepts : 2-6 concepts ou notions clés, précis ;
- abstract : 1-2 phrases de synthèse (ce que le document est / établit).

## Références (métadonnées uniquement)
${rows}

Réponds en JSON strict uniquement :
{"profiles":[{"sourceId":"...","subjects":["..."],"concepts":["..."],"abstract":"..."}]}`;
}

/**
 * Synthèse des profils par lots de sources (métadonnées seules, jamais le
 * contenu intégral). Les ids inconnus sont filtrés silencieusement (garde pure).
 */
export async function buildProfiles(
  sources: Source[],
  client: StructuredModelClient,
  options: BuildProfilesOptions = {}
): Promise<SourceProfile[]> {
  const batchSize = Math.max(1, options.batchSize ?? 20);
  const known = new Set(sources.map((s) => s.id));
  const profiles: SourceProfile[] = [];

  for (let start = 0; start < sources.length; start += batchSize) {
    const lot = sources.slice(start, start + batchSize);
    const raw = await client.generateJson(buildProfilesPrompt(lot));
    const parsed = BatchProfilesSchema.parse(raw);
    for (const profile of parsed.profiles) {
      if (known.has(profile.sourceId)) {
        profiles.push(profile);
      }
    }
  }

  return profiles;
}

export function createLibrary(sources: Source[]): Library {
  return { sources: [...sources], profiles: [] };
}

/**
 * Fusion incrémentale : upsert des profils par sourceId (les profils existants
 * pour d'autres sources sont conservés). Ne mute pas l'entrée.
 */
export function mergeLibraryProfiles(
  library: Library,
  newProfiles: SourceProfile[]
): Library {
  const byId = new Map<string, SourceProfile>();
  for (const p of library.profiles) byId.set(p.sourceId, p);
  for (const p of newProfiles) byId.set(p.sourceId, p);
  return { ...library, profiles: [...byId.values()] };
}

/** Sources du corpus qui n'ont pas encore de profil (pour l'ingestion incrémentale). */
export function selectUnprofiled(
  sources: Source[],
  profiles: SourceProfile[]
): Source[] {
  const known = new Set(profiles.map((p) => p.sourceId));
  return sources.filter((s) => !known.has(s.id));
}