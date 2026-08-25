import {
  createDiffractiveReader,
  type BookPartInput,
  type DiffractiveReadingRequest,
  type BookPlanEntryInput,
  type BookPlanInput,
  type BookPlanNoteInput,
  type BookBibliographyInput,
  type ExistingCutInput,
} from "./diffractiveReader";
import {
  findNode,
  formatNeighborhood,
  queryNeighborhood,
  type KnowledgeGraph,
} from "../bibliography/graphify";
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
  bookPlanPath?: string;
  bibliographyPath?: string;
  graphPath?: string;
  graphTerms?: string[];
  concepts?: Array<{ label: string; definition: string }>;
  tensions?: Array<{ label: string; description: string }>;
  bookParts?: BookPartInput[];
  existingCuts?: ExistingCutInput[];
  bookPlan?: BookPlanInput[];
  bookBibliography?: BookBibliographyInput;
  graphNeighborhoods?: Array<{ term: string; text: string }>;
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
/**
 * Extrait des BookPlanInput d'un fichier JSON brut (bookPlan.json) :
 * { partId, partTitle, entries: [{ id, subject, preview?, notes? }] }.
 * Fonction pure, sans I/O.
 */
export function extractBookPlan(raw: unknown): BookPlanInput[] {
  if (!Array.isArray(raw)) return [];
  const out: BookPlanInput[] = [];
  for (const item of raw) {
    const p = item as {
      partId?: unknown;
      partTitle?: unknown;
      entries?: unknown;
    } | null;
    if (
      !p ||
      typeof p.partId !== "string" ||
      typeof p.partTitle !== "string" ||
      !Array.isArray(p.entries)
    ) {
      continue;
    }
    const entries: BookPlanEntryInput[] = [];
    for (const e of p.entries) {
      const rawEntry = e as {
        id?: unknown;
        subject?: unknown;
        preview?: unknown;
        notes?: unknown;
        unitId?: unknown;
        unitVersion?: unknown;
      } | null;
      if (!rawEntry || typeof rawEntry.id !== "string" || typeof rawEntry.subject !== "string") {
        continue;
      }
      const notes: BookPlanNoteInput[] = [];
      if (Array.isArray(rawEntry.notes)) {
        for (const n of rawEntry.notes) {
          const rawNote = n as { kind?: unknown; text?: unknown } | null;
          if (
            rawNote &&
            (rawNote.kind === "human" || rawNote.kind === "agent") &&
            typeof rawNote.text === "string"
          ) {
            notes.push({ kind: rawNote.kind, text: rawNote.text });
          }
        }
      }
      entries.push({
        id: rawEntry.id,
        subject: rawEntry.subject,
        preview: typeof rawEntry.preview === "string" ? rawEntry.preview : undefined,
        notes: notes.length > 0 ? notes : undefined,
        unitId: typeof rawEntry.unitId === "string" ? rawEntry.unitId : undefined,
        unitVersion:
          typeof rawEntry.unitVersion === "number" ? rawEntry.unitVersion : undefined,
      });
    }
    if (entries.length === 0) continue;
    out.push({ partId: p.partId, partTitle: p.partTitle, entries });
  }
  return out;
}

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
    else if (flag === "--book-plan") args.bookPlanPath = argv[++i] ?? "";
    else if (flag === "--bibliography") args.bibliographyPath = argv[++i] ?? "";
    else if (flag === "--graph") args.graphPath = argv[++i] ?? "";
    else if (flag === "--graph-terms") args.graphTerms = splitList(argv[++i]);
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

/**
 * Extrait la bibliothèque projetée d'un fichier library.json brut (F0) :
 * { sources: [{ id, title, authors }], profiles: [{ sourceId, subjects,
 * concepts }] }. Les profils sans source connue sont ignorés. Pure, sans I/O.
 */
export function extractBookBibliography(
  raw: unknown
): BookBibliographyInput | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const data = raw as { sources?: unknown; profiles?: unknown };
  const sourceById = new Map<string, { title?: string; authors?: string[] }>();
  if (Array.isArray(data.sources)) {
    for (const item of data.sources) {
      const s = item as { id?: unknown; title?: unknown; authors?: unknown } | null;
      if (!s || typeof s.id !== "string") continue;
      const authors = Array.isArray(s.authors)
        ? s.authors.filter((a): a is string => typeof a === "string")
        : undefined;
      sourceById.set(s.id, {
        title: typeof s.title === "string" ? s.title : undefined,
        authors: authors && authors.length > 0 ? authors : undefined,
      });
    }
  }
  const strList = (v: unknown): string[] | undefined =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string")
      : undefined;
  const entries: BookBibliographyInput["entries"] = [];
  if (Array.isArray(data.profiles)) {
    for (const item of data.profiles) {
      const p = item as {
        sourceId?: unknown;
        subjects?: unknown;
        concepts?: unknown;
      } | null;
      if (!p || typeof p.sourceId !== "string") continue;
      const source = sourceById.get(p.sourceId);
      if (!source) continue;
      entries.push({
        sourceId: p.sourceId,
        title: source.title,
        authors: source.authors,
        subjects: strList(p.subjects),
        concepts: strList(p.concepts),
      });
    }
  }
  return entries.length > 0 ? { entries } : undefined;
}

/**
 * Extrait les voisinages du graphe autour de termes (BFS budgété, zéro token).
 * Chaque terme trouvé devient un signal { terme, voisinage formaté } pour le
 * prompt. Les termes sans nœud correspondant sont ignorés (garde pure).
 */
export function buildGraphNeighborhoods(
  graph: KnowledgeGraph,
  terms: string[],
  options: { depth?: number; maxNodes?: number } = {}
): Array<{ term: string; text: string }> {
  const out: Array<{ term: string; text: string }> = [];
  for (const term of terms) {
    if (!term.trim()) continue;
    const node = findNode(graph, term);
    if (!node) continue;
    const hood = queryNeighborhood(graph, node.id, options);
    out.push({ term, text: formatNeighborhood(hood) });
  }
  return out;
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
  if (args.bookPlan && args.bookPlan.length > 0) {
    request.bookPlan = args.bookPlan;
  }
  const neighborhoods =
    args.graphNeighborhoods && args.graphNeighborhoods.length > 0
      ? args.graphNeighborhoods
      : undefined;
  if (args.bookBibliography || neighborhoods) {
    request.bookBibliography = {
      entries: args.bookBibliography?.entries ?? [],
      graphNeighborhoods: neighborhoods,
    };
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
