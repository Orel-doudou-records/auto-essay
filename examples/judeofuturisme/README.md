# Exemple - Judéofuturisme

Démonstration de `@auto-essay/core` utilisé comme **moteur neutre**, avec un
profil personnel chargé comme **données** (jamais compilé dans le moteur).

## Fichiers

- `project.json` - le profil `EssayProject` (problématique, voix, catalogue).
- `concepts.json` - les `Concept` du projet.
- `tensions.json` - les `Tension` du projet.
- `bibliography.bib` - la bibliographie (illustrative, à remplacer par la tienne).
- `manuscript.json` - l'**arbre du manuscrit** en cours d'écriture : actes,
  chapitres, parties planifiées (ADR-006). Les feuilles référencent des
  versions d'unités ; la position est l'ordre.
- `units.json` - les `DraftUnit` référencées par l'arbre, avec leur statut
  de rédaction (verified pour l'Acte I, drafting pour l'Acte II).
- `run.ts` - script qui charge les données, ingère la biblio, découvre les
  relations et projette l'état du livre (`projectBookState`).

## Lancer

```bash
npm run build:core             # compile le moteur vers dist/
npm run example:judeofuturisme # exécute run.ts
```

La sortie inclut `bookParts` : la forme canonique (id, titre, statut dérivé,
taille) que le lecteur diffractif reçoit comme « état du livre en cours ».

## Modifier (sans toucher au moteur)

- La **problématique** : `project.json` (`argumentMap.centralQuestion`).
- Le **vocabulaire d'analyse** : `concepts.json` / `tensions.json`.
- La **bibliographie** : `bibliography.bib`.
- La **structure du livre** : `manuscript.json` (arbre) — un chapitre
  planifié est un nœud sans enfant (`chap-4`, Acte II).
- Le **statut de rédaction** : `units.json` (`status` de chaque unité) —
  c'est lui qui pilote l'état projeté.

## Bibliothèque du chapitre 2 graphifiée (pont Graphify, F4/G1)

Le chapitre 2 (« Le salon ») est documenté par le corpus **Jews in space**
(corpus entier extracté par graphify : 3 286 nœuds / 3 223 arêtes). Ce dossier
embarque un **sous-graphe budgété** dédié au chapitre :

- `graph-chap2.json` - voisinages BFS (depth 2, maxNodes 30) autour des termes
  du chapitre (asimov, gernsback, joanna russ, star trek, superman,
  jews in space, wandering stars, golem, diaspora), mergés et dédupliqués.
- `library-chap2.json` - les sources « paper/document » du sous-graphe, pour
  `--bibliography` (profil vide : le graphe porte déjà subjects/concepts).
- `build-graph-chap2.mjs` - régénère les deux fichiers depuis le graph.json
  fusionné par graphify-portable :
  `node build-graph-chap2.mjs <graph.json du corpus complet>` (défaut :
  `./graph.json` à côté du script).

### Lecture diffractive avec le graphe

```bash
npm run diffract -w @auto-essay/api -- \
  --statement "Le vaisseau est un salon : ..." \
  --book-parts /chemin/bookParts.json \
  --book-plan examples/judeofuturisme/plan.json \
  --concepts examples/judeofuturisme/concepts.json \
  --tensions examples/judeofuturisme/tensions.json \
  --bibliography examples/judeofuturisme/library-chap2.json \
  --graph examples/judeofuturisme/graph-chap2.json \
  --graph-terms "asimov,star trek,superman,jews in space,diaspora"
```

Le prompt reçoit chaque voisinage comme **signal candidat** (section « Signaux
du graphe de la bibliothèque ») : le graphe suggère des rapprochements, le
lecteur les qualifie dans `bibliographyImpacts` (rapprocher / redistribuer /
source manquante).

Aucun de ces contenus n'est compilé dans le moteur : ils sont chargés au runtime.
La bibliographie est illustrative ; remplace-la par tes propres références.