import type { BibliographyImpact } from "../domain/diffractiveReading";
import type { BibliographyDistributionEntry } from "../domain/bibliographyDistribution";

/**
 * Application pure des impacts bibliographiques (F3) : la diffraction propose
 * une redistribution, on la projette sur la distribution sans jamais muter
 * l'entrée d'origine.
 * - redistribuer : la source change de scope (son lien existant est mis à jour) ;
 * - rapprocher : un lien source ↔ scope est ajouté s'il n'existe pas ;
 * - manquante : lien ajouté avec confiance faible (signal, pas une certitude).
 */
export function applyBibliographyImpacts(
  distribution: readonly BibliographyDistributionEntry[],
  impacts: readonly BibliographyImpact[]
): BibliographyDistributionEntry[] {
  const entries = distribution.map((entry) => ({ ...entry }));
  for (const impact of impacts) {
    if (impact.kind === "redistribuer") {
      const index = entries.findIndex((e) => e.sourceId === impact.sourceId);
      if (index >= 0) {
        entries[index] = {
          ...entries[index],
          scopeId: impact.scopeId,
          rationale: impact.impact,
          confidence: entries[index].confidence ?? 0.8,
        };
      } else {
        entries.push({
          sourceId: impact.sourceId,
          scopeId: impact.scopeId,
          rationale: impact.impact,
          confidence: 0.8,
        });
      }
    } else {
      const exists = entries.some(
        (e) =>
          e.sourceId === impact.sourceId && e.scopeId === impact.scopeId
      );
      if (!exists) {
        entries.push({
          sourceId: impact.sourceId,
          scopeId: impact.scopeId,
          rationale: impact.impact,
          confidence: impact.kind === "rapprocher" ? 0.7 : 0.4,
        });
      }
    }
  }
  return entries;
}