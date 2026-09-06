import { readFileSync } from "node:fs";
import { z } from "zod";
import {
  createDiffractiveBatchRunner,
  extractBookParts,
  extractConcepts,
  extractExistingCuts,
  extractBookPlan,
  extractTensions,
  type DiffractiveBatchFragment,
} from "@auto-essay/core";
import { createModelClient } from "../llm/client.js";
import { StructuredClientAdapter } from "../llm/structuredAdapter.js";
import { loadEnvironmentFile, readJson, readOptions, runCli } from "./cliSupport.js";

loadEnvironmentFile();

const FragmentSchema = z.object({
  statement: z.string().min(1),
  claimIds: z.array(z.string().min(1)).optional(),
  sourceIds: z.array(z.string().min(1)).optional(),
});

/**
 * Entrée de commande générique : lecture diffractive par lot.
 *
 * Usage :
 *   npm run diffract-batch -w @auto-essay/api -- \
 *     --fragments /chemin/fragments.json \
 *     --book-file /chemin/manuscrit.txt \
 *     --concepts concepts.json --tensions tensions.json \
 *     --book-parts bookParts.json --cuts cuts.json
 */
async function main(): Promise<void> {
  const options = readOptions(process.argv.slice(2));
  const fragmentsPath = options.fragments;
  const bookPath = options["book-file"];
  const conceptsPath = options.concepts;
  const tensionsPath = options.tensions;
  const bookPartsPath = options["book-parts"];
  const cutsPath = options.cuts;
  const bookPlanPath = options["book-plan"];

  if (!fragmentsPath) {
    throw new Error("Missing required --fragments <fichier.json>");
  }

  const rawFragments = readJson(fragmentsPath);
  const fragments = z
    .array(FragmentSchema)
    .min(1)
    .parse(rawFragments) as DiffractiveBatchFragment[];
  const book = bookPath ? readFileSync(bookPath, "utf8") : undefined;
  const concepts = extractConcepts(readJson(conceptsPath));
  const tensions = extractTensions(readJson(tensionsPath));
  const bookParts = extractBookParts(readJson(bookPartsPath));
  const existingCuts = extractExistingCuts(readJson(cutsPath));
  const bookPlan = extractBookPlan(readJson(bookPlanPath));

  const client = await createModelClient();
  const structured = new StructuredClientAdapter(client);
  const runner = createDiffractiveBatchRunner(structured);
  const result = await runner.run({
    fragments,
    book,
    bookParts,
    bookPlan,
    existingCuts,
    concepts,
    tensions,
  });

  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

runCli(main);
