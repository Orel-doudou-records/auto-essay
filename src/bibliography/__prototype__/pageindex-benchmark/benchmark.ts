import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import {
  findNode,
  formatNeighborhood,
  parseKnowledgeGraph,
  queryNeighborhood,
} from "../../graphify.js";

type Engine = "graphify" | "prefix" | "pageindex";
type Reason =
  | "structuring" | "contrast" | "counterexample" | "exception"
  | "conceptual_shift" | "practice" | "support" | "contradiction"
  | "qualification" | "alternative";

interface Probe { id: string; reason: Reason; query: string }
interface BenchmarkCase {
  id: string;
  title: string;
  mode: "exploration" | "corroboration";
  subject: string;
  hypothesis?: string;
  sourceIds: string[];
  graphTerms: string[];
  probes: Probe[];
}
interface Item {
  id: string;
  kind: "passage" | "graph_signal";
  probeId: string;
  sourceId?: string;
  pageRange?: string;
  text: string;
  reason: Reason;
  sourceFingerprint?: string;
  provenance?: "verified_exact" | "verified_normalized" | "rejected";
}
interface Run {
  caseId: string;
  engine: Engine;
  items: Item[];
  diagnostics: { durationMs: number; errors: string[] };
}
interface Manifest { documents: Array<{ sourceId: string; path: string }> }

const cases: BenchmarkCase[] = [
  {
    id: "exploration-salon",
    title: "Exploration sans thèse — le salon spatial",
    mode: "exploration",
    subject: "Le vaisseau comme salon diasporique : autonomie, sociabilité et fabrication institutionnelle",
    sourceIds: [
      "dialnetjewsinspaceahistoryofextraterrestrialdiasp_william_tenn",
      "jewish_fantasy_worldwide_trends_in_speculative_sto_s047_wandering_stars",
      "jewish_fantasy_worldwide_trends_in_speculative_sto_s047_star_trek",
      "jewish_fantasy_worldwide_trends_in_speculative_sto_s047_on_venus_have_we_got_a_rabbi",
      "dialnetjewsinspaceahistoryofextraterrestrialdiasp_daniel_boyarin",
    ],
    graphTerms: ["jews in space", "wandering stars", "star trek", "diaspora"],
    probes: [
      { id: "structure", reason: "structuring", query: "Quels passages structurent le rapport entre diaspora, espace et vie collective ?" },
      { id: "practice", reason: "practice", query: "Quelles pratiques matérielles ou institutionnelles donnent corps à cet imaginaire ?" },
      { id: "exception", reason: "exception", query: "Quels passages résistent à une lecture unifiée de l'espace comme émancipation ?" },
    ],
  },
  {
    id: "corroboration-autonomie",
    title: "Corroboration — l'espace fabrique-t-il l'autonomie ?",
    mode: "corroboration",
    subject: "Imaginaire spatial et autonomie collective",
    hypothesis: "L'imaginaire spatial fonctionne comme un moyen matériel de construire une autonomie collective.",
    sourceIds: [
      "jewish_fantasy_worldwide_trends_in_speculative_sto_foundation",
      "motifs_of_secrecy_hawkins_foundations_edge",
      "jewish_fantasy_worldwide_trends_in_speculative_sto_s047_star_trek",
      "dialnetjewsinspaceahistoryofextraterrestrialdiasp_hannah_arendt",
      "atlantic_juif_zotero_import_jewish_sanctuary_in_the_atlantic_world",
    ],
    graphTerms: ["foundation", "star trek", "hannah arendt", "jewish sanctuary"],
    probes: [
      { id: "support", reason: "support", query: "Quels passages soutiennent directement l'hypothèse ?" },
      { id: "contradiction", reason: "contradiction", query: "Quels passages la contredisent ou montrent une dépendance persistante ?" },
      { id: "qualification", reason: "qualification", query: "Quelles limites obligent à qualifier le sens d'autonomie collective ?" },
      { id: "alternative", reason: "alternative", query: "Quelle autre explication rend compte des mêmes pratiques ou récits ?" },
    ],
  },
  {
    id: "tension-regimes",
    title: "Tension — récit, théorie et histoire matérielle",
    mode: "exploration",
    subject: "Traductions et écarts entre fiction spéculative, théorie diasporique et histoire matérielle",
    sourceIds: [
      "jewish_fantasy_worldwide_trends_in_speculative_sto_s047_brooklyn_project",
      "dialnetjewsinspaceahistoryofextraterrestrialdiasp_daniel_boyarin",
      "dialnetjewsinspaceahistoryofextraterrestrialdiasp_jonathan_boyarin",
      "atlantic_juif_zotero_import_the_sephardic_atlantic_colonial_histories_and_postcolonial_perspectives",
      "jewish_fantasy_worldwide_trends_book_of_esther",
    ],
    graphTerms: ["brooklyn project", "daniel boyarin", "diaspora", "sephardic atlantic"],
    probes: [
      { id: "translation", reason: "conceptual_shift", query: "Où des vocabulaires différents deviennent-ils traduisibles ?" },
      { id: "scale", reason: "contrast", query: "Quels écarts relèvent d'un changement d'échelle plutôt que d'une contradiction ?" },
      { id: "counterexample", reason: "counterexample", query: "Quel passage empêche de fusionner fiction, théorie et histoire ?" },
    ],
  },
];

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../../..");
const graphPath = join(root, "examples/judeofuturisme/graph-chap2.json");
const workerPath = join(here, "pageindex_worker.py");
const storePath = join(root, ".scratch/pageindex-prototype-store-WIPE-ME");
const manifestPath = process.env.AUTO_ESSAY_PAGEINDEX_MANIFEST ?? join(here, "manifest.local.json");
const criteria = ["pertinence", "non-redondance", "utilité argumentative", "intérêt intellectuel"];

const manifest = (): Manifest | undefined =>
  existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest
    : undefined;

async function graphify(benchmarkCase: BenchmarkCase): Promise<Run> {
  const started = performance.now();
  const graph = parseKnowledgeGraph(JSON.parse(await readFile(graphPath, "utf8")));
  const items: Item[] = [];
  for (const [index, term] of benchmarkCase.graphTerms.entries()) {
    const node = findNode(graph, term);
    if (!node) continue;
    items.push({
      id: `graphify:${benchmarkCase.id}:${index}`,
      kind: "graph_signal",
      probeId: "graph-neighborhood",
      text: formatNeighborhood(queryNeighborhood(graph, node.id, { depth: 2, maxNodes: 30 })),
      reason: "conceptual_shift",
    });
  }
  return { caseId: benchmarkCase.id, engine: "graphify", items,
    diagnostics: { durationMs: Math.round(performance.now() - started), errors: [] } };
}

function python(engine: "prefix" | "pageindex", benchmarkCase: BenchmarkCase, docs: Manifest): Promise<Run> {
  return new Promise((accept, reject) => {
    const child = spawn(process.env.AUTO_ESSAY_PAGEINDEX_PYTHON ?? "python3", [workerPath], {
      env: process.env, stdio: ["pipe", "pipe", "pipe"],
    });
    let output = "";
    let error = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => { output += chunk; });
    child.stderr.on("data", (chunk: string) => { error += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(error.trim() || `Python: code ${code}`));
      else {
        try { accept(JSON.parse(output) as Run); }
        catch { reject(new Error(`JSON Python invalide: ${output.slice(0, 300)}`)); }
      }
    });
    child.stdin.end(JSON.stringify({ engine, case: benchmarkCase, manifest: docs, storagePath: storePath }));
  });
}

function pythonStatus(): string {
  const check = spawnSync(process.env.AUTO_ESSAY_PAGEINDEX_PYTHON ?? "python3", ["-c", "import pageindex, PyPDF2"]);
  return check.status === 0 ? "prêt" : "PageIndex/PyPDF2 absents";
}

function summary(run?: Run): string {
  if (!run) return "non exécuté";
  const rejected = run.items.filter((item) => item.provenance === "rejected").length;
  return `${run.items.length} éléments · ${run.diagnostics.durationMs} ms · ${rejected} rejet(s) · ${run.diagnostics.errors.length} erreur(s)`;
}

interface Review { queue: Array<{ label: string; engine: Engine; item: Item }>; item: number; criterion: number; scores: number[] }
interface State { caseIndex: number; runs: Partial<Record<Engine, Run>>; review?: Review; message?: string }

function labels(caseId: string): Record<Engine, string> {
  const variants = [["A", "B", "C"], ["B", "C", "A"], ["C", "A", "B"]];
  const hash = [...caseId].reduce((sum, value) => sum + value.charCodeAt(0), 0);
  const current = variants[hash % variants.length];
  return { graphify: current[0], prefix: current[1], pageindex: current[2] };
}

function beginReview(state: State): State {
  const current = cases[state.caseIndex];
  const blind = labels(current.id);
  const queue = (Object.entries(state.runs) as Array<[Engine, Run]>).flatMap(([engine, run]) =>
    run.items.map((item) => ({ label: blind[engine], engine, item })));
  queue.sort((a, b) => `${a.label}:${a.item.id}`.localeCompare(`${b.label}:${b.item.id}`));
  return { ...state, review: { queue, item: 0, criterion: 0, scores: [] } };
}

function render(state: State): void {
  console.clear();
  const current = cases[state.caseIndex];
  console.log("\x1b[1mPROTOTYPE JETABLE — PageIndex ↔ Graphify\x1b[0m");
  console.log("Question: PageIndex améliore-t-il assez la matière documentaire pour remplacer Graphify ?\n");
  console.log(`\x1b[1mCas ${state.caseIndex + 1}/${cases.length}\x1b[0m — ${current.title}`);
  console.log(`${current.mode} · ${current.subject}`);
  if (current.hypothesis) console.log(`Hypothèse: ${current.hypothesis}`);
  console.log(`Manifest: ${manifest() ? "présent" : "absent"} · Python: ${pythonStatus()}\n`);
  console.log(`Graphify  ${summary(state.runs.graphify)}`);
  console.log(`Préfixe   ${summary(state.runs.prefix)}`);
  console.log(`PageIndex ${summary(state.runs.pageindex)}`);
  if (state.message) console.log(`\n${state.message}`);
  if (state.review) {
    const review = state.review;
    if (review.item >= review.queue.length) {
      console.log("\n\x1b[1mRevue terminée\x1b[0m");
      const blind = labels(current.id);
      console.log(`Graphify=${blind.graphify} Préfixe=${blind.prefix} PageIndex=${blind.pageindex}`);
      const average = review.scores.length ? review.scores.reduce((a, b) => a + b, 0) / review.scores.length : 0;
      console.log(`Moyenne générale: ${average.toFixed(2)}/3`);
    } else {
      const entry = review.queue[review.item];
      console.log(`\n\x1b[1mRevue aveugle ${entry.label}\x1b[0m — ${review.item + 1}/${review.queue.length}`);
      console.log(`${criteria[review.criterion]} · provenance ${entry.item.provenance ?? "n/a"}`);
      console.log(entry.item.text.slice(0, 1200));
      console.log("\n[0-3] noter  [x] sortir");
      return;
    }
  }
  console.log("\n[g] Graphify  [b] préfixe  [i] PageIndex  [r] revue");
  console.log("[n] suivant  [p] précédent  [q] quitter");
}

async function execute(engine: Engine, state: State): Promise<State> {
  const current = cases[state.caseIndex];
  try {
    const docs = manifest();
    if (engine !== "graphify" && !docs) throw new Error(`Créer ${manifestPath} depuis manifest.example.json`);
    const run = engine === "graphify" ? await graphify(current) : await python(engine, current, docs!);
    return { ...state, runs: { ...state.runs, [engine]: run }, message: `${engine}: terminé` };
  } catch (error) {
    return { ...state, message: error instanceof Error ? error.message : String(error) };
  }
}

function preflight(): void {
  console.log(`Graph fixture: ${existsSync(graphPath) ? "ok" : "absente"}`);
  console.log(`Manifest PDF: ${manifest() ? "ok" : "absent"}`);
  console.log(`Python: ${pythonStatus()}`);
  cases.forEach((item) => console.log(`- ${item.id}: ${item.sourceIds.length} sources, ${item.probes.length} probes`));
}

async function main(): Promise<void> {
  if (process.argv.includes("--dry-run") || !process.stdin.isTTY) return preflight();
  await mkdir(storePath, { recursive: true });
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  let state: State = { caseIndex: 0, runs: {} };
  render(state);
  for await (const raw of readline) {
    const command = raw.trim().toLowerCase();
    if (state.review && /^[0-3]$/.test(command)) {
      const score = Number(command);
      const criterion = state.review.criterion + 1;
      state = { ...state, review: { ...state.review, scores: [...state.review.scores, score],
        criterion: criterion === criteria.length ? 0 : criterion,
        item: state.review.item + (criterion === criteria.length ? 1 : 0) } };
    } else if (command === "x") state = { ...state, review: undefined };
    else if (command === "g" || command === "b" || command === "i")
      state = await execute(command === "g" ? "graphify" : command === "b" ? "prefix" : "pageindex", state);
    else if (command === "r") state = beginReview(state);
    else if (command === "n" || command === "p") state = {
      caseIndex: (state.caseIndex + (command === "n" ? 1 : cases.length - 1)) % cases.length, runs: {},
    };
    else if (command === "q") { readline.close(); break; }
    render(state);
  }
}

await main();
