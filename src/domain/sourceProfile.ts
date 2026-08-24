import { z } from "zod";

/**
 * Profil sémantique compact d'une source : c'est CE QUE le moteur lit,
 * jamais le texte intégral (spec F, F0 — « le moteur connaît des types pas
 * des instances »).
 */
export const SourceProfileSchema = z.object({
  /** Référence vers la source profilée (Source.id). */
  sourceId: z.string().min(1),
  /** 2-4 sujets/thèmes généraux du document. */
  subjects: z.array(z.string().min(1)).default([]),
  /** 2-6 concepts ou notions clés, précis. */
  concepts: z.array(z.string().min(1)).default([]),
  /** Synthèse d'une à deux phrases (ce que le document est/établit). */
  abstract: z.string().optional(),
});

export type SourceProfile = z.infer<typeof SourceProfileSchema>;
export type SourceProfileInput = z.input<typeof SourceProfileSchema>;

export function createSourceProfile(input: SourceProfileInput): SourceProfile {
  return SourceProfileSchema.parse(input);
}