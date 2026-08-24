import { z } from "zod";

/**
 * Lien de distribution bibliographique : une source associée à un scope du
 * manuscrit (id de nœud, chapitre ou paragraphe — cohérent ADR-006).
 */
export const BibliographyDistributionEntrySchema = z.object({
  /** Source du corpus (Source.id). */
  sourceId: z.string().min(1),
  /** Scope cible : id de nœud du manuscrit (chapitre ou paragraphe). */
  scopeId: z.string().min(1),
  /** Justification du lien (mots-clés, évaluation du modèle, etc.). */
  rationale: z.string().optional(),
  /** Confiance du lien, 0..1 (défaut : 1 pour un lien mécanique). */
  confidence: z.number().min(0).max(1).optional(),
});

export type BibliographyDistributionEntry = z.infer<
  typeof BibliographyDistributionEntrySchema
>;
export type BibliographyDistributionEntryInput = z.input<
  typeof BibliographyDistributionEntrySchema
>;

/** Distribution complète : toutes les associations source ↔ scope du projet. */
export const BibliographyDistributionSchema = z
  .object({
    projectId: z.string().min(1),
    entries: z.array(BibliographyDistributionEntrySchema).default([]),
  })
  .superRefine((distribution, context) => {
    const seen = new Set<string>();
    for (const [index, entry] of distribution.entries.entries()) {
      const key = `${entry.sourceId}::${entry.scopeId}`;
      if (seen.has(key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["entries", index],
          message: `Duplicate source↔scope link: ${key}`,
        });
      }
      seen.add(key);
    }
  });

export type BibliographyDistribution = z.infer<
  typeof BibliographyDistributionSchema
>;
export type BibliographyDistributionInput = z.input<
  typeof BibliographyDistributionSchema
>;

export function createBibliographyDistribution(
  input: BibliographyDistributionInput
): BibliographyDistribution {
  return BibliographyDistributionSchema.parse(input);
}