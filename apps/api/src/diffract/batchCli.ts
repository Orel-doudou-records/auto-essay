import { readFileSync } from "node:fs";
import { z } from "zod";
import {
  createDiffractiveBatchRunner,
  extractConcepts,
  extractTensions,
  type DiffractiveBatchFragment,
} from "@auto-essay/core";
import { createModelClient } from "../llm/client.js";
import { StructuredClientAdapter } from "../llm/structuredAdapter.js";

// Charge .env (OLLAMA_API_KEY / OLLAMA_MODEL) — sans dépendance externe.
try {
  process.loadEnvFile();
} catch {
  // Pas de .env : on utilise l'environnement existant.
}

const FragmentSchema = z.object({
  statement: z.string().min(1),
  claimIds: z.array(z.string().min(1)).optional(),
  sourceIds: z.array(z.string().min(1)).optional(),
});

function readJsonArray(path: string | undefined): unknown {
  if (!path) return undefined;
  return JSON.parse(readFileSync(path, "utf8"));
}

function flag(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

/**
 * Entrée de commande générique : lecture diffractive par lot.
 *
 * Usage :
 *   npm run diffract-batch -w @auto-essay/api -- \
 *     --fragments /chemin/fragments.json \
 *     --book-file /chemin/manuscrit.txt \
 *     --concepts concepts.json --tensions tensions.json
 */
async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const fragmentsPath = flag(argv, "--fragments");
  const bookPath = flag(argv, "--book-file");
  const conceptsPath = flag(argv, "--concepts");
  const tensionsPath = flag(argv, "--tensions");

  if (!fragmentsPath) {
    throw new Error("Missing required --fragments <fichier.json>");
  }

  const rawFragments = readJsonArray(fragmentsPath);
  const fragments = z
    .array(FragmentSchema)
    .min(1)
    .parse(rawFragments) as DiffractiveBatchFragment[];
  const book = bookPath ? readFileSync(bookPath, "utf8") : undefined;
  const concepts = extractConcepts(readJsonArray(conceptsPath));
  const tensions = extractTensions(readJsonArray(tensionsPath));

  const client = await createModelClient();
  const structured = new StructuredClientAdapter(client);
  const runner = createDiffractiveBatchRunner(structured);
  const result = await runner.run({ fragments, book, concepts, tensions });

  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
