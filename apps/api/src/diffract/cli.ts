import { readFileSync } from "node:fs";
import {
  buildDiffractiveRequest,
  extractBookParts,
  extractBookBibliography,
  extractConcepts,
  extractExistingCuts,
  extractBookPlan,
  extractTensions,
  formatReading,
  parseDiffractArgs,
  runDiffract,
} from "@auto-essay/core";
import { createModelClient } from "../llm/client.js";
import { StructuredClientAdapter } from "../llm/structuredAdapter.js";
import { loadEnvironmentFile, readJson, runCli } from "./cliSupport.js";

loadEnvironmentFile();

/**
 * Entrée de commande générique : lecture diffractive d'un fragment posé
 * dans un livre, via le modèle configuré (OLLAMA_API_KEY / OLLAMA_MODEL).
 *
 * Usage :
 *   npm run diffract -w @auto-essay/api -- \
 *     --statement "Le messianisme se technicise." \
 *     --book-file /chemin/vers/manuscrit.txt \
 *     --concepts /chemin/concepts.json --tensions /chemin/tensions.json \
 *     --claims claim-1,claim-2 --sources source-1 \
 *     --book-parts /chemin/bookParts.json --cuts /chemin/cuts.json \
 *     --bibliography /chemin/library.json
 */
async function main(): Promise<void> {
  const args = parseDiffractArgs(process.argv.slice(2));

  const book = args.bookPath ? readFileSync(args.bookPath, "utf8") : args.book;
  const concepts = extractConcepts(readJson(args.conceptsPath));
  const tensions = extractTensions(readJson(args.tensionsPath));
  const bookParts = extractBookParts(readJson(args.bookPartsPath));
  const existingCuts = extractExistingCuts(readJson(args.cutsPath));
  const bookPlan = extractBookPlan(readJson(args.bookPlanPath));
  const bookBibliography = extractBookBibliography(
    readJson(args.bibliographyPath)
  );

  const request = buildDiffractiveRequest({
    ...args,
    book,
    concepts,
    tensions,
    bookParts,
    bookPlan,
    existingCuts,
    bookBibliography,
  });

  const client = await createModelClient();
  const structured = new StructuredClientAdapter(client);
  const reading = await runDiffract(request, structured);

  process.stdout.write(formatReading(reading) + "\n");
}

runCli(main);
