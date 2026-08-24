import { z } from "zod";
import type { StructuredModelClient } from "../evaluation/evaluateEssay";
import type { BibliographyImpact } from "../domain/diffractiveReading";

/**
 * Pont Graphify (F4) — lecture du graphe produit par graphify.
 * Graphify fournit des signaux candidats ; Autoessay les qualifie
 * (accepte / transforme / rejette) : la sémantique canonique reste ici.
 */

export interface GraphNode {
  id: string;
  label: string;
  file_type?: string;
  source_file?: string;
  [key: string]: unknown;
}

export interface GraphLink {
  source: string;
  target: string;
  relation?: string;
  confidence?: string;
  confidence_score?: number;
  [key: string]: unknown;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  links: GraphLink[];
}

export const KnowledgeGraphSchema = z.object({
  nodes: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        file_type: z.string().optional(),
        source_file: z.string().optional(),
      })
    )
    .default([]),
  links: z
    .array(
      z.object({
        source: z.string().min(1),
        target: z.string().min(1),
        relation: z.string().optional(),
        confidence: z.string().optional(),
        confidence_score: z.number().optional(),
      })
    )
    .default([]),
});

/** Parse le graph.json de graphify (node-link), tolérant aux champs extra. */
export function parseKnowledgeGraph(raw: unknown): KnowledgeGraph {
  const data = KnowledgeGraphSchema.parse(raw);
  return { nodes: data.nodes, links: data.links };
}

/** Voisinage extrait : un sous-graphe budgeté, à donner au worker. */
export interface GraphNeighborhood {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface QueryOptions {
  /** Profondeur BFS (défaut 2). */
  depth?: number;
  /** Nombre maximal de nœuds à conserver (défaut 40). */
  maxNodes?: number;
}

/** Meilleur nœud dont le label contient le terme (insensible à la casse). */
export function findNode(graph: KnowledgeGraph, term: string): GraphNode | undefined {
  const needle = term.toLowerCase();
  const scored = graph.nodes
    .map((node) => ({
      node,
      score: needle.split(/\s+/).filter((w) => node.label.toLowerCase().includes(w))
        .length,
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.node;
}

/**
 * Voisinage BFS budgeté : part d'un nœud, explore en largeur jusqu'à `depth`,
 * coupe à `maxNodes`. Zéro token (traversée déterministe).
 */
export function queryNeighborhood(
  graph: KnowledgeGraph,
  startId: string,
  options: QueryOptions = {}
): GraphNeighborhood {
  const depth = Math.max(1, options.depth ?? 2);
  const maxNodes = Math.max(1, options.maxNodes ?? 40);
  const adjacency = new Map<string, string[]>();
  for (const link of graph.links) {
    const a = adjacency.get(link.source) ?? [];
    a.push(link.target);
    adjacency.set(link.source, a);
    const b = adjacency.get(link.target) ?? [];
    b.push(link.source);
    adjacency.set(link.target, b);
  }

  const included = new Set<string>([startId]);
  let frontier = [startId];
  for (let d = 0; d < depth && included.size < maxNodes; d++) {
    const next: string[] = [];
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

  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const nodes = [...included]
    .map((id) => nodeById.get(id))
    .filter((n): n is GraphNode => n !== undefined);
  const links = graph.links.filter(
    (l) => included.has(l.source) && included.has(l.target)
  );
  return { nodes, links };
}

/** Plus court chemin entre deux concepts (BFS non pondéré, profondeur ≤ 8). */
export function shortestPath(
  graph: KnowledgeGraph,
  fromTerm: string,
  toTerm: string
): GraphNode[] | undefined {
  const from = findNode(graph, fromTerm);
  const to = findNode(graph, toTerm);
  if (!from || !to) return undefined;
  if (from.id === to.id) return [from];

  const adjacency = new Map<string, string[]>();
  for (const link of graph.links) {
    (adjacency.get(link.source) ?? adjacency.set(link.source, []).get(link.source)!)
      .push(link.target);
    (adjacency.get(link.target) ?? adjacency.set(link.target, []).get(link.target)!)
      .push(link.source);
  }

  const queue: string[][] = [[from.id]];
  const visited = new Set<string>([from.id]);
  while (queue.length > 0) {
    const path = queue.shift()!;
    const current = path[path.length - 1];
    if (path.length > 8) return undefined;
    for (const neighbor of adjacency.get(current) ?? []) {
      if (neighbor === to.id) return [...path, neighbor].map((id) =>
        graph.nodes.find((n) => n.id === id)
      ).filter((n): n is GraphNode => n !== undefined);
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([...path, neighbor]);
      }
    }
  }
  return undefined;
}

/** Format compact d'un voisinage pour le worker (nœuds + arêtes taguées). */
export function formatNeighborhood(
  neighborhood: GraphNeighborhood
): string {
  const lines: string[] = [`Voisinage du graphe (${neighborhood.nodes.length} nœuds, ${neighborhood.links.length} arêtes) :`];
  for (const node of neighborhood.nodes) {
    lines.push(`- ${node.label} [${node.file_type ?? "nœud"}] (${node.source_file ?? ""})`);
  }
  for (const link of neighborhood.links) {
    const source = neighborhood.nodes.find((n) => n.id === link.source)?.label ?? link.source;
    const target = neighborhood.nodes.find((n) => n.id === link.target)?.label ?? link.target;
    lines.push(
      `* ${source} --${link.relation ?? "?"} [${link.confidence ?? "?"} ${link.confidence_score ?? ""}]--> ${target}`
    );
  }
  return lines.join("\n");
}

/** Signal qualifié par le moteur (frontière sémantique Graphify/Autoessay). */
export interface QualifiedGraphSignal {
  accepted: boolean;
  /** Impact de rapprochement (F3) si le signal est accepté. */
  impact?: BibliographyImpact;
  rationale: string;
}

const QualificationSchema = z.object({
  accepted: z.boolean(),
  impact: z
    .object({
      sourceId: z.string().min(1),
      scopeId: z.string().min(1),
      impact: z.string().min(1),
    })
    .optional(),
  rationale: z.string().min(1),
});

export function buildQualifyPrompt(signal: string): string {
  return `Tu es la couche sémantique d'un moteur d'essai. Un graphe de corpus (Graphify) propose un signal candidat : un rapprochement entre sources ou concepts. La sémantique canonique est À TOI : accepte, transforme ou rejette ce signal.

## Signal du graphe
${signal}

Décide :
- accepted : le rapprochement est fondé et utile pour la pensée en cours ;
- impact (si accepted) : un impact de rapprochement {sourceId, scopeId, impact} où impact décrit la valeur du rapprochement ;
- rationale : pourquoi (acceptation, transformation ou rejet).

Réponds en JSON strict uniquement :
{"accepted": true|false, "impact": {"sourceId": "...", "scopeId": "...", "impact": "..."} | null, "rationale": "..."}`;
}

/**
 * Qualification d'un signal du graphe (un appel structuré, sortie validée).
 * Le kind est forcé à « rapprocher » (le signal du graphe propose un lien).
 */
export async function qualifyGraphSignal(
  signal: string,
  client: StructuredModelClient
): Promise<QualifiedGraphSignal> {
  const raw = await client.generateJson(buildQualifyPrompt(signal));
  const parsed = QualificationSchema.parse(raw);
  if (!parsed.accepted || !parsed.impact) {
    return { accepted: false, rationale: parsed.rationale };
  }
  return {
    accepted: true,
    impact: {
      sourceId: parsed.impact.sourceId,
      scopeId: parsed.impact.scopeId,
      kind: "rapprocher",
      impact: parsed.impact.impact,
    },
    rationale: parsed.rationale,
  };
}