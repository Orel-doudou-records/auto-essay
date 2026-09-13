import { readFileSync } from "node:fs";
import { createLibrary, type Library } from "@auto-essay/core";
import { importBibTeX } from "@auto-essay/core";
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
 * Ingestion de l'index bibliographique : importe les références BibTeX comme
 * `Source`, sans prétendre comprendre les documents depuis leurs métadonnées.
 *
 * Les `SourceProfile` Corpus V2 sont construits ultérieurement à partir de
 * vrais `IngestedDocument`.
 *
 * Usage :
 *   npm run ingest -w @auto-essay/api -- \
 *     --bib /chemin/bibliography.bib [--library /chemin/library.json] \
 *     [--out /chemin/library.json]
 */
async function main(): Promise<void> {
  const options = readOptions(process.argv.slice(2));
  const bibPath = options.bib;
  const libraryPath = options.library;
  const outPath = options.out ?? "library.json";

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

  writeJson(library, outPath);
  writeCliMessage(
    `library.json écrit : ${library.sources.length} sources, ${library.profiles.length} profils existants.`
  );
  writeCliWarning(
    "Les nouvelles références ne sont plus profilées depuis les seules métadonnées BibTeX ; ingérez leur contenu documentaire avant la Comprehension Closure."
  );
}

runCli(main);
