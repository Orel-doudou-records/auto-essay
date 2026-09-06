import {
  draftPlanEntry,
  extractBookPlan,
  type BookPlanInput,
} from "@auto-essay/core";
import { createModelClient } from "../llm/client.js";
import { StructuredClientAdapter } from "../llm/structuredAdapter.js";
import { loadEnvironmentFile, readJson, readOptions, runCli, writeJson } from "./cliSupport.js";

loadEnvironmentFile();

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
  const options = readOptions(process.argv.slice(2));
  const planPath = options.plan;
  const entryId = options.entry;
  const outPath = options.out;

  if (!planPath || !entryId) {
    throw new Error("Missing required --plan <fichier.json> --entry <id>");
  }

  const plan = extractBookPlan(readJson(planPath)) as BookPlanInput[];

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

  writeJson(result, outPath);
}

runCli(main);
