import { readFileSync } from "node:fs";
import {
  buildDiffractiveRequest,
  formatReading,
  parseDiffractArgs,
  runDiffract,
} from "@auto-essay/core";
import { createModelClient } from "../llm/client.js";
import { StructuredClientAdapter } from "../llm/structuredAdapter.js";

/**
 * Entrée de commande générique : lecture diffractive d'un fragment posé
 * dans un livre, via le modèle configuré (OLLAMA_API_KEY / OLLAMA_MODEL).
 *
 * Usage :
 *   npm run diffract -w @auto-essay/api -- \
 *     --statement "Le messianisme se technicise." \
 *     --book-file /chemin/vers/manuscrit.txt \
 *     --claims claim-1,claim-2 --sources source-1
 */
async function main(): Promise<void> {
  const args = parseDiffractArgs(process.argv.slice(2));

  const book = args.bookPath ? readFileSync(args.bookPath, "utf8") : args.book;

  const request = buildDiffractiveRequest({ ...args, book });

  const client = await createModelClient();
  const structured = new StructuredClientAdapter(client);
  const reading = await runDiffract(request, structured);

  process.stdout.write(formatReading(reading) + "\n");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
