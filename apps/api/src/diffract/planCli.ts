import { cliOutput } from "../observability/cliOutput.js";
import { readFileSync, writeFileSync } from "node:fs";
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

// Charge .env (OLLAMA_API_KEY / OLLAMA_MODEL) — sans dépendance externe.
try {
  process.loadEnvFile();
} catch {
  // Pas de .env : on utilise l'environnement existant.
}

function readJsonArray(path: string | undefined): unknown {
  if (!path) return undefined;
  return JSON.parse(readFileSync(path, "utf8"));
}

function flag(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

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
  const argv = process.argv.slice(2);
  const planPath = flag(argv, "--plan");
  const bookPartsPath = flag(argv, "--book-parts");
  const cutsPath = flag(argv, "--cuts");
  const outPath = flag(argv, "--out");

  if (!planPath) {
    throw new Error("Missing required --plan <fichier.json>");
  }

  const plan = extractBookPlan(readJsonArray(planPath)) as BookPlanInput[];
  const bookParts = extractBookParts(readJsonArray(bookPartsPath));
  const existingCuts = extractExistingCuts(readJsonArray(cutsPath));

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
  const output = JSON.stringify(result, null, 2);
  if (outPath) {
    writeFileSync(outPath, output);
  } else {
    process.stdout.write(output + "\n");
  }
}

main().catch((error: unknown) => {
  cliOutput.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});