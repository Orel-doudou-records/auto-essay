import { cliOutput } from "../observability/cliOutput.js";
import { readFileSync, writeFileSync } from "node:fs";
import {
  buildProfiles,
  createLibrary,
  mergeLibraryProfiles,
  type Library,
} from "@auto-essay/core";
import { importBibTeX } from "@auto-essay/core";
import { createModelClient } from "../llm/client.js";
import { StructuredClientAdapter } from "../llm/structuredAdapter.js";

try {
  process.loadEnvFile();
} catch {
  // Pas de .env : environnement existant.
}

function flag(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

/**
 * Ingestion de la bibliothèque (F0) : importe un corpus (.bib), synthétise les
 * profils par lots (métadonnées seules), et écrit library.json.
 *
 * Usage :
 *   npm run ingest -w @auto-essay/api -- \
 *     --bib /chemin/bibliography.bib [--library /chemin/library.json] \
 *     [--out /chemin/library.json] [--batch 20]
 */
async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const bibPath = flag(argv, "--bib");
  const libraryPath = flag(argv, "--library");
  const outPath = flag(argv, "--out") ?? "library.json";
  const batch = Number.parseInt(flag(argv, "--batch") ?? "20", 10);

  if (!bibPath) {
    throw new Error("Missing required --bib <fichier.bib>");
  }

  const projectId = "bibliography";
  const { sources, errors } = importBibTeX(readFileSync(bibPath, "utf8"), projectId);
  if (errors.length > 0) {
    cliOutput.error(`Erreurs d'import bibliographie : ${errors.length}`);
  }

  let library: Library = createLibrary(sources);
  if (libraryPath) {
    const existing = JSON.parse(readFileSync(libraryPath, "utf8")) as Library;
    library = { sources, profiles: existing.profiles ?? [] };
  }

  const client = await createModelClient();
  const structured = new StructuredClientAdapter(client);

  const unprofiled = sources.filter(
    (s) => !library.profiles.some((p) => p.sourceId === s.id)
  );
  const profiles = await buildProfiles(unprofiled, structured, { batchSize: batch });

  const merged = mergeLibraryProfiles(library, profiles);
  writeFileSync(outPath, JSON.stringify(merged, null, 2));
  cliOutput.success(
    `library.json écrit : ${merged.sources.length} sources, ${merged.profiles.length} profils (${profiles.length} nouveaux).`
  );
}

main().catch((error: unknown) => {
  cliOutput.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});