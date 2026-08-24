import { z } from "zod";
import type { StructuredModelClient } from "../evaluation/evaluateEssay";
import {
  assertBookPlanValid,
  formatPlanEntry,
  formatPlanPart,
  type BookPlanEntryInput,
  type BookPlanInput,
} from "./diffractiveReader";

/** Le brouillon rédigé pour une entrée de plan, sous enveloppe JSON. */
const DraftContentSchema = z.object({
  content: z.string().min(1),
});

export type DraftContent = z.infer<typeof DraftContentSchema>;

/** Cherche une entrée de plan par id dans tout le plan (pur). */
export function findPlanEntry(
  plan: BookPlanInput[],
  entryId: string
): { part: BookPlanInput; entry: BookPlanEntryInput } | undefined {
  for (const part of plan) {
    const entry = part.entries.find((e) => e.id === entryId);
    if (entry) return { part, entry };
  }
  return undefined;
}

/** Prompt de rédaction : le chapitre + son plan, l'entrée cible, les notes. */
export function buildDraftPrompt(
  part: BookPlanInput,
  entry: BookPlanEntryInput
): string {
  return `Tu es un rédacteur d'essai. Rédige le paragraphe du plan ci-dessous : une prose d'essai continue (10 à 15 phrases), qui respecte l'intention de l'auteur (notes) et l'aperçu élaboré, et se connecte au reste du chapitre.

## Le chapitre et son plan
${formatPlanPart(part)}

## Paragraphe à rédiger
${formatPlanEntry(entry)}

## Consignes
- Prose continue : pas de liste, pas de titre, pas de markdown.
- Ancre le paragraphe dans le chapitre (le précédent et le suivant) sans conclure définitivement si ce n'est pas la fin.
- Ne réécris pas le plan : écris le paragraphe.

## Format JSON strict
{"content": "le paragraphe rédigé"}`;
}

/**
 * Rédige le paragraphe d'une entrée de plan à la demande (spec E, E4).
 * L'entrée porte l'intention (notes) et l'aperçu ; le chapitre fournit le
 * contexte. Refuse une entrée inconnue ou déjà écrite (trace unitId/unitVersion).
 */
export async function draftPlanEntry(
  plan: BookPlanInput[],
  entryId: string,
  client: StructuredModelClient
): Promise<string> {
  assertBookPlanValid(plan);
  const found = findPlanEntry(plan, entryId);
  if (!found) {
    throw new Error(`Plan entry '${entryId}' not found`);
  }
  if (found.entry.unitId !== undefined) {
    throw new Error(
      `Plan entry '${entryId}' is already written (unit ${found.entry.unitId}@${found.entry.unitVersion})`
    );
  }
  const raw = await client.generateJson(
    buildDraftPrompt(found.part, found.entry)
  );
  return DraftContentSchema.parse(raw).content;
}