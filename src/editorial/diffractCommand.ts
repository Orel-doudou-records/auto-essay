import {
  createDiffractiveReader,
  type BookPartInput,
  type DiffractiveReadingRequest,
  type ExistingCutInput,
} from "./diffractiveReader";
import type { DraftUnitStatus } from "../domain/draftUnit";
import type { StructuredModelClient } from "../evaluation/evaluateEssay";
import type { DiffractiveReading } from "../domain/diffractiveReading";

/**
 * Arguments d'une commande de lecture diffractive (CLI générique).
 * `book` est le texte fourni en ligne ; `bookPath` un fichier à lire par
 * l'appelant (la commande elle-même reste sans I/O). `conceptsPath` /
 * `tensionsPath` sont des fichiers JSON lus par l'appelant ; `concepts` /
 * `tensions` sont les données déjà chargées (passées à `buildDiffractiveRequest`).
 */
export interface DiffractCliArgs {
  statement: string;
  book?: string;
  bookPath?: string;
  claimIds: string[];
  sourceIds: string[];
  conceptsPath?: string;
  tensionsPath?: string;
  bookPartsPath?: string;
  cutsPath?: string;
  concepts?: Array<{ label: string; definition: string }>;
  tensions?: Array<{ label: string; description: string }>;
  bookParts?: BookPartInput[];
  existingCuts?: ExistingCutInput[];
}

/**
 * Extrait { label, definition } d'objets concepts bruts (ex. concepts.json :
 * { id, label, definition, scope, status, ... }).
 * Fonction pure, sans I/O : on ne garde que ce que le lecteur diffractif consomme.
 */
export function extractConcepts(
  raw: unknown
): Array<{ label: string; definition: string }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ label: string; definition: string }> = [];
  for (const item of raw) {
    const c = item as { label?: unknown; definition?: unknown } | null;
    if (!c || typeof c.label !== "string") continue;
    out.push({
      label: c.label,
      definition: typeof c.definition === "string" ? c.definition : "",
    });
  }
  return out;
}

/**
 * Extrait { label, description } d'objets tensions bruts (ex. tensions.json).
 * Fonction pure, sans I/O.
 */
export function extractTensions(
  raw: unknown
): Array<{ label: string; description: string }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ label: string; description: string }> = [];
  for (const item of raw) {
    const t = item as { label?: unknown; description?: unknown } | null;
    if (!t || typeof t.label !== "string") continue;
    out.push({
      label: t.label,
      description: typeof t.description === "string" ? t.description : "",
    });
  }
  return out;
}

/**
 * Extrait des BookPartInput d'un fichier JSON brut (bookParts.json) :
 * { id, title, status, text }. Fonction pure, sans I/O.
 */
export function extractBookParts(raw: unknown): BookPartInput[] {
  if (!Array.isArray(raw)) return [];
  const out: BookPartInput[] = [];
  for (const item of raw) {
    const p = item as {
      id?: unknown;
      title?: unknown;
      status?: unknown;
      text?: unknown;
    } | null;
    if (
      !p ||
      typeof p.id !== "string" ||
      typeof p.title !== "string" ||
      typeof p.status !== "string"
    ) {
      continue;
    }
    out.push({
      id: p.id,
      title: p.title,
      status: p.status as DraftUnitStatus,
      text: typeof p.text === "string" ? p.text : "",
    });
  }
  return out;
}

/**
 * Extrait des ExistingCutInput d'un fichier JSON brut (cuts.json) :
 * { scope, verdict, cut }. Fonction pure, sans I/O.
 */
export function extractExistingCuts(raw: unknown): ExistingCutInput[] {
  if (!Array.isArray(raw)) return [];
  const out: ExistingCutInput[] = [];
  for (const item of raw) {
    const c = item as {
      scope?: unknown;
      verdict?: unknown;
      cut?: unknown;
    } | null;
    if (
      !c ||
      typeof c.scope !== "string" ||
      typeof c.verdict !== "string" ||
      typeof c.cut !== "string"
    ) {
      continue;
    }
    out.push({ scope: c.scope, verdict: c.verdict, cut: c.cut });
  }
  return out;
}

/**
 * Parse les arguments d'une ligne de commande :
 * --statement <texte> --book <texte> --book-file <chemin>
 * --claims <a,b,c> --sources <a,b,c>
 * --concepts <fichier.json> --tensions <fichier.json>
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
    else if (flag === "--concepts") args.conceptsPath = argv[++i] ?? "";
    else if (flag === "--tensions") args.tensionsPath = argv[++i] ?? "";
    else if (flag === "--book-parts") args.bookPartsPath = argv[++i] ?? "";
    else if (flag === "--cuts") args.cutsPath = argv[++i] ?? "";
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
  const request: DiffractiveReadingRequest = {
    statement: args.statement,
    claimIds: args.claimIds,
    sourceIds: args.sourceIds,
    book: args.book,
  };
  if (args.concepts && args.concepts.length > 0) {
    request.concepts = args.concepts;
  }
  if (args.tensions && args.tensions.length > 0) {
    request.tensions = args.tensions;
  }
  if (args.bookParts && args.bookParts.length > 0) {
    request.bookParts = args.bookParts;
  }
  if (args.existingCuts && args.existingCuts.length > 0) {
    request.existingCuts = args.existingCuts;
  }
  return request;
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
