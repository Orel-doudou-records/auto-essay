import {
  applyPlanPreviews,
  diffractPlan,
  elaboratePlanPreview,
  extractBookParts,
  extractBookPlan,
  extractExistingCuts,
  type BookPlanInput,
} from "@auto-essay/core";
import { createModelClient } from "../llm/client.js";
import { StructuredClientAdapter } from "../llm/structuredAdapter.js";
import { loadEnvironmentFile, readJson, readOptions, runCli, writeJson } from "./cliSupport.js";

loadEnvironmentFile();

/**
 * Entrée de commande : élaboration et diffraction du plan d'ébauche.
 *
 * Usage :
 *   npm run diffract-plan -w @auto-essay/api -- \
 *     --plan /chemin/plan.json \
 *     [--book-parts /chemin/bookParts.json] [--cuts /chemin/cuts.json] \
 *     [--out /chemin/resultat.json]
 *
 * Pas de fichier de sortie → le résultat est écrit sur stdout.
 */
async function main(): Promise<void> {
  const options = readOptions(process.argv.slice(2));
  const planPath = options.plan;
  const bookPartsPath = options["book-parts"];
  const cutsPath = options.cuts;
  const outPath = options.out;

  if (!planPath) {
    throw new Error("Missing required --plan <fichier.json>");
  }

  const plan = extractBookPlan(readJson(planPath)) as BookPlanInput[];
  const bookParts = extractBookParts(readJson(bookPartsPath));
  const existingCuts = extractExistingCuts(readJson(cutsPath));

  const client = await createModelClient();
  const structured = new StructuredClientAdapter(client);

  // 1. Élaborer les previews par paragraphe.
  const previews = await elaboratePlanPreview(plan, structured);

  // 2. Enrichir le plan, puis le diffracter.
  const enriched = applyPlanPreviews(plan, previews);
  const reading = await diffractPlan(
    { plan: enriched, bookParts, existingCuts },
    structured
  );

  const result = { previews, reading };
  writeJson(result, outPath);
}

runCli(main);
