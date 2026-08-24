import { readFileSync } from "node:fs";
import {
  buildDiffractiveRequest,
  extractBookParts,
  extractConcepts,
  extractExistingCuts,
  extractTensions,
  formatReading,
  parseDiffractArgs,
  runDiffract,
} from "@auto-essay/core";
import { createModelClient } from "../llm/client.js";
import { StructuredClientAdapter } from "../llm/structuredAdapter.js";

// Charge .env (OLLAMA_API_KEY / OLLAMA_MODEL) — sans dépendance externe.
try {
  process.loadEnvFile();
} catch {
  // Pas de .env : on utilise l'environnement existant.
}

/**
 * Entrée de commande générique : lecture diffractive d'un fragment posé
 * dans un livre, via le modèle configuré (OLLAMA_API_KEY / OLLAMA_MODEL).
 *
 * Usage :
 *   npm run diffract -w @auto-essay/api -- \
 *     --statement "Le messianisme se technicise." \
 *     --book-file /chemin/vers/manuscrit.txt \
 *     --concepts /chemin/concepts.json --tensions /chemin/tensions.json \
 *     --claims claim-1,claim-2 --sources source-1
 *     --book-parts /chemin/bookParts.json --cuts /chemin/cuts.json
 */
function readJsonArray(path: string | undefined): unknown {
  if (!path) return undefined;
  return JSON.parse(readFileSync(path, "utf8"));
}

async function main(): Promise<void> {
  const args = parseDiffractArgs(process.argv.slice(2));

  const book = args.bookPath ? readFileSync(args.bookPath, "utf8") : args.book;
  const concepts = extractConcepts(readJsonArray(args.conceptsPath));
  const tensions = extractTensions(readJsonArray(args.tensionsPath));
  const bookParts = extractBookParts(readJsonArray(args.bookPartsPath));
  const existingCuts = extractExistingCuts(readJsonArray(args.cutsPath));

  const request = buildDiffractiveRequest({
    ...args,
    book,
    concepts,
    tensions,
    bookParts,
    existingCuts,
  });

  const client = await createModelClient();
  const structured = new StructuredClientAdapter(client);
  const reading = await runDiffract(request, structured);

  process.stdout.write(formatReading(reading) + "\n");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
