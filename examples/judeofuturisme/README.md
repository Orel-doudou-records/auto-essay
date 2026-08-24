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

Aucun de ces contenus n'est compilé dans le moteur : ils sont chargés au runtime.
La bibliographie est illustrative ; remplace-la par tes propres références.