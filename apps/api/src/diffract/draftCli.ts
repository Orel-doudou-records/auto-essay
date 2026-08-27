import { cliOutput } from "../observability/cliOutput.js";
import { readFileSync, writeFileSync } from "node:fs";
import {
  draftPlanEntry,
  extractBookPlan,
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
 * Entrée de commande : rédaction d'un paragraphe du plan, à la demande.
 *
 * Usage :
 *   npm run draft-plan -w @auto-essay/api -- \
 *     --plan /chemin/plan.json --entry chap2-06 \
 *     [--out /chemin/brouillon.json]
 *
 * La sortie contient l'entrée, le brouillon rédigé, et la trace suggérée
 * (unitId/unitVersion à poser sur l'entrée pour la marquer écrite).
 */
async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const planPath = flag(argv, "--plan");
  const entryId = flag(argv, "--entry");
  const outPath = flag(argv, "--out");

  if (!planPath || !entryId) {
    throw new Error("Missing required --plan <fichier.json> --entry <id>");
  }

  const plan = extractBookPlan(readJsonArray(planPath)) as BookPlanInput[];

  const client = await createModelClient();
  const structured = new StructuredClientAdapter(client);

  const content = await draftPlanEntry(plan, entryId, structured);
  const result = {
    entryId,
    content,
    markWritten: {
      note: "Poser unitId/unitVersion sur l'entrée pour la marquer écrite (trace)",
    },
  };

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