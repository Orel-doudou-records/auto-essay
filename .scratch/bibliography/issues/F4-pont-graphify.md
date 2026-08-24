# F4 — Pont Graphify (populate + round-trip + frontière sémantique)

## Contexte

Graphify est branché et opérationnel (backend ollama, ingestion réelle en
cours). Le brief impose la frontière : Graphify fournit des **signaux
candidats** (graphe + communautés + `surprising_connections`) ; Autoessay les
**qualifie** (accepte / transforme / enrichit / rejette). La sémantique
canonique reste dans Autoessay.

## Objectif

- **Populate** : les sources + profils + relations détectées (sujet partagé,
  concept partagé, co-citation) sont poussées vers le graphe graphify.
- **Round-trip** : Diffract interroge le graphe pour un scope donné →
  sous-graphe pertinent (voisinage, chemins) → rapprochements candidats.
- **Frontière** : les candidats du graphe passent par une qualification
  Autoessay (worker) avant d'entrer dans la sémantique canonique.

## Changements proposés

- Adapter de lecture `graph.json` (nœuds/arêtes/communautés) : types + parse,
  `queryNeighborhood(graph, scopeId)` (BFS, budget tokens), `shortestPath` entre
  deux concepts (réutilise la CLI `graphify path` ou une lecture directe).
- `graphifyAdapter` dans `apps/api` : sous-ensemble JSON compact pour le
  worker (les nœuds voisins + arêtes, jamais le graphe entier).
- `qualifyGraphSignal(signal, client)` : un appel structuré qui accepte /
  transforme / rejette un rapprochement candidat → `BibliographyImpact` (F3).
- Rapport : communautés + god nodes + `surprising_connections` d'un corpus.

## Vérifications

- Tests : parse `graph.json` réel (fixture du chapitre « Jews in space »),
  BFS budgeté, qualification avec fake client, chemins.
- Typecheck complet (core + api) avant merge.