import {
  createDiffractiveReader,
  type DiffractiveReadingRequest,
} from "./diffractiveReader";
import type { StructuredModelClient } from "../evaluation/evaluateEssay";
import type { DiffractiveReading } from "../domain/diffractiveReading";

/**
 * Arguments d'une commande de lecture diffractive (CLI générique).
 * `book` est le texte fourni en ligne ; `bookPath` un fichier à lire par
 * l'appelant (la commande elle-même reste sans I/O).
 */
export interface DiffractCliArgs {
  statement: string;
  book?: string;
  bookPath?: string;
  claimIds: string[];
  sourceIds: string[];
}

/**
 * Parse les arguments d'une ligne de commande :
 * --statement <texte> --book <texte> --book-file <chemin>
 * --claims <a,b,c> --sources <a,b,c>
 */
export function parseDiffractArgs(argv: string[]): DiffractCliArgs {
  const args: DiffractCliArgs = { statement: "", claimIds: [], sourceIds: [] };

  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--statement") args.statement = argv[++i] ?? "";
    else if (flag === "--book") args.book = argv[++i] ?? "";
    else if (flag === "--book-file") args.bookPath = argv[++i] ?? "";
    else if (flag === "--claims") args.claimIds = splitList(argv[++i]);
    else if (flag === "--sources") args.sourceIds = splitList(argv[++i]);
  }

  if (!args.statement.trim()) {
    throw new Error("Missing required --statement");
  }

  return args;
}

export function splitList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function buildDiffractiveRequest(
  args: DiffractCliArgs
): DiffractiveReadingRequest {
  return {
    statement: args.statement,
    claimIds: args.claimIds,
    sourceIds: args.sourceIds,
    book: args.book,
  };
}

export async function runDiffract(
  request: DiffractiveReadingRequest,
  client: StructuredModelClient
): Promise<DiffractiveReading> {
  return createDiffractiveReader(client).read(request);
}

export function formatReading(reading: DiffractiveReading): string {
  return JSON.stringify(reading, null, 2);
}
