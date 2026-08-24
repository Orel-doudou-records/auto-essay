import { z } from "zod";
import type { StructuredModelClient } from "../evaluation/evaluateEssay";
import type { DiffractiveReading } from "../domain/diffractiveReading";
import {
  assertBookPlanValid,
  createDiffractiveReader,
  formatPlanPart,
  type BookPartInput,
  type BookPlanInput,
  type ExistingCutInput,
} from "./diffractiveReader";

/**
 * Un aperçu élaboré pour une entrée de plan : 2–3 phrases qui disent ce que
 * le paragraphe prévu VA dire (un projet, pas le paragraphe lui-même).
 */
export const PlanPreviewEntrySchema = z.object({
  entryId: z.string().min(1),
  preview: z.string().min(1),
});

export type PlanPreviewEntry = z.infer<typeof PlanPreviewEntrySchema>;

const RawPlanPreviewsSchema = z.array(PlanPreviewEntrySchema);

/** Prompt d'élaboration : le plan brut → un projet de preview par entrée. */
export function buildPlanPreviewPrompt(plan: BookPlanInput[]): string {
  const parts = plan.map(formatPlanPart).join("\n\n");
  return `Tu es un élaborateur de plan. Pour chaque paragraphe PRÉVU (pas encore écrit), écris un aperçu de 2 à 3 phrases : ce que ce paragraphe va dire, son rôle dans le chapitre, et ce qu'il doit connecter (le paragraphe précédent et le suivant si pertinent). Les notes (humain/agent) indiquent l'intention de l'auteur : respecte-les.

## Le plan
${parts}

## Format JSON strict
[{"entryId": "string", "preview": "string"}]

Réponds UNIQUEMENT avec le JSON, une entrée par paragraphe du plan (même ordre).`;
}

/**
 * Élabore les previews d'un plan avec le modèle structuré. Ne conserve que
 * les entrées dont l'id existe réellement dans le plan (garde pure).
 */
export async function elaboratePlanPreview(
  plan: BookPlanInput[],
  client: StructuredModelClient
): Promise<PlanPreviewEntry[]> {
  assertBookPlanValid(plan);
  const raw = await client.generateJson(buildPlanPreviewPrompt(plan));
  const parsed = RawPlanPreviewsSchema.parse(raw);
  const validIds = new Set(
    plan.flatMap((part) => part.entries.map((entry) => entry.id))
  );
  return parsed.filter((entry) => validIds.has(entry.entryId));
}

/**
 * Retourne le plan enrichi des previews élaborées (fusion par entryId,
 * les ids inconnus sont ignorés). Pur, sans I/O.
 */
export function applyPlanPreviews(
  plan: BookPlanInput[],
  previews: PlanPreviewEntry[]
): BookPlanInput[] {
  const byId = new Map(previews.map((p) => [p.entryId, p.preview]));
  return plan.map((part) => ({
    ...part,
    entries: part.entries.map((entry) =>
      byId.has(entry.id) ? { ...entry, preview: byId.get(entry.id) } : entry
    ),
  }));
}

export interface DiffractPlanInput {
  /** Le plan d'ébauche, objet de la lecture (idéalement enrichi des previews). */
  plan: BookPlanInput[];
  bookParts?: BookPartInput[];
  existingCuts?: ExistingCutInput[];
}

/**
 * Diffracte le PLAN lui-même : le fragment est le plan (structure prévue,
 * paragraphes, transitions). Le verdict porte donc sur le plan :
 * integrate_now = prêt à guider l'écriture ; adapt_differently = le plan
 * doit être modifié (l'action précise où) ; incubate = certains éléments
 * pas mûrs ; archive/discard = ne pas suivre ce plan. Réutilise le moteur
 * diffractif (aucun fork).
 */
export async function diffractPlan(
  input: DiffractPlanInput,
  client: StructuredModelClient
): Promise<DiffractiveReading> {
  return createDiffractiveReader(client).read({
    statement:
      "Le plan d'ébauche du livre (structure prévue, paragraphes, transitions). Ce plan est-il prêt à guider l'écriture ?",
    bookParts: input.bookParts,
    existingCuts: input.existingCuts,
    bookPlan: input.plan,
  });
}