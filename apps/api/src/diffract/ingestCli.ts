import { readFileSync } from "node:fs";
import {
  buildProfiles,
  createLibrary,
  mergeLibraryProfiles,
  type Library,
} from "@auto-essay/core";
import { importBibTeX } from "@auto-essay/core";
import { createModelClient } from "../llm/client.js";
import { StructuredClientAdapter } from "../llm/structuredAdapter.js";
import {
  loadEnvironmentFile,
  readOptions,
  runCli,
  writeCliMessage,
  writeCliWarning,
  writeJson,
} from "./cliSupport.js";

loadEnvironmentFile();

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
  const options = readOptions(process.argv.slice(2));
  const bibPath = options.bib;
  const libraryPath = options.library;
  const outPath = options.out ?? "library.json";
  const batch = Number.parseInt(options.batch ?? "20", 10);

  if (!bibPath) {
    throw new Error("Missing required --bib <fichier.bib>");
  }

  const projectId = "bibliography";
  const { sources, errors } = importBibTeX(readFileSync(bibPath, "utf8"), projectId);
  if (errors.length > 0) {
    writeCliWarning(`Erreurs d'import bibliographie : ${errors.length}`);
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
  writeJson(merged, outPath);
  writeCliMessage(
    `library.json écrit : ${merged.sources.length} sources, ${merged.profiles.length} profils (${profiles.length} nouveaux).`
  );
}

runCli(main);
