#!/usr/bin/env node
/**
 * build-graph-chap2.mjs - sous-graphe du chapitre 2 (Le salon) pour l'exemple.
 *
 * Lit le graph.json fusionné par graphify-portable (corpus « Jews in space »,
 * la bibliothèque du chapitre 2), et en extrait un sous-graphe budgété autour
 * des termes du chapitre : voisinages BFS (depth 2, maxNodes 30) mergés, puis
 * réécrit dans un format léger (nœuds/arêtes essentiels) + library-chap2.json
 * (les sources "paper" du sous-graphe, pour --bibliography).
 *
 * Usage :
 *   node build-graph-chap2.mjs <graph.json du corpus complet> [--out examples/judeofuturisme]
 *   (défaut : graph.json adjacent au script)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const defaultGraph = join(here, "graph.json");
const source = resolve(process.argv[2] ?? defaultGraph);
// Le script vit à côté de ses sorties : examples/judeofuturisme/.
const outDir = here;

// Termes du chapitre 2 (« Le salon » → Abikou, Asimov, Star Trek, Superman…),
// alignés sur examples/judeofuturisme/plan.json (partId chap-2).
const TERMS = [
  "asimov",           // chap2-09 Asimov, Hugo Gernsback & Joanna Russ
  "gernsback",        // chap2-09
  "joanna russ",      // chap2-09
  "star trek",        // chap2-14 Star Trek et le salon inclusif
  "superman",         // chap2-12 Superman, le masque
  "jews in space",    // chap2-16 Mais où sont les juifs dans l'espace ?
  "wandering stars",  // anthologies juives de SF (More Wandering Stars…)
  "golem",            // transcription L'ancêtre de Terminator est un golem
  "diaspora",         // chap2-15 l'errance spatiale comme symbole diasporique
];

const DEPTH = 2;
const MAX_NODES = 30;

function loadGraph(path) {
  const raw = readFileSync(path, "utf8");
  const json = JSON.parse(raw.replace(/^\uFEFF/, ""));
  return { nodes: json.nodes ?? [], links: json.links ?? json.edges ?? [] };
}

function findNode(graph, term) {
  const needle = term.toLowerCase();
  const scored = graph.nodes
    .map((node) => ({
      node,
      score: needle
        .split(/\s+/)
        .filter((w) => (node.label ?? "").toLowerCase().includes(w)).length,
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.node;
}

function neighborhood(graph, startId, depth, maxNodes) {
  const adjacency = new Map();
  for (const link of graph.links) {
    const a = adjacency.get(link.source) ?? [];
    a.push(link.target);
    adjacency.set(link.source, a);
    const b = adjacency.get(link.target) ?? [];
    b.push(link.source);
    adjacency.set(link.target, b);
  }
  const included = new Set([startId]);
  let frontier = [startId];
  for (let d = 0; d < depth && included.size < maxNodes; d++) {
    const next = [];
    for (const node of frontier) {
      for (const neighbor of adjacency.get(node) ?? []) {
        if (!included.has(neighbor) && included.size < maxNodes) {
          included.add(neighbor);
          next.push(neighbor);
        }
      }
    }
    frontier = next;
  }
  return included;
}

const graph = loadGraph(source);
const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
const included = new Set();
const foundTerms = [];
for (const term of TERMS) {
  const node = findNode(graph, term);
  if (!node) {
    console.warn(`[skip] aucun nœud pour "${term}"`);
    continue;
  }
  foundTerms.push({ term, nodeId: node.id });
  for (const id of neighborhood(graph, node.id, DEPTH, MAX_NODES)) {
    included.add(id);
  }
}

if (foundTerms.length === 0) {
  console.error("Aucun terme trouvé dans le graphe source.");
  process.exit(1);
}

const nodes = [...included]
  .map((id) => nodeById.get(id))
  .filter(Boolean)
  .map((n) => ({
    id: n.id,
    label: n.label,
    file_type: n.file_type,
    ...(n.author ? { author: n.author } : {}),
    ...(n.source_file ? { source_file: n.source_file } : {}),
  }));
const links = graph.links
  .filter((l) => included.has(l.source) && included.has(l.target))
  .map((l) => ({
    source: l.source,
    target: l.target,
    ...(l.relation ? { relation: l.relation } : {}),
    ...(l.confidence ? { confidence: l.confidence } : {}),
    ...(typeof l.confidence_score === "number"
      ? { confidence_score: l.confidence_score }
      : {}),
  }));

const graphChap2 = { nodes, links };
const libraryChap2 = {
  sources: nodes
    .filter((n) => n.file_type === "paper" || n.file_type === "document")
    .map((n) => ({
      id: n.id,
      title: n.label,
      ...(n.author
        ? { authors: n.author.split(";").map((a) => a.trim()).filter(Boolean) }
        : {}),
    })),
  profiles: [],
};

mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(outDir, "graph-chap2.json"),
  JSON.stringify(graphChap2, null, 1) + "\n"
);
writeFileSync(
  join(outDir, "library-chap2.json"),
  JSON.stringify(libraryChap2, null, 2) + "\n"
);

console.log(
  JSON.stringify(
    {
      source,
      terms: foundTerms.map((t) => t.term),
      nodes: nodes.length,
      links: links.length,
      sources: libraryChap2.sources.length,
      graphOut: join(outDir, "graph-chap2.json"),
      libraryOut: join(outDir, "library-chap2.json"),
    },
    null,
    2
  )
);