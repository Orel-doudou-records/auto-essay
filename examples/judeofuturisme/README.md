# Exemple — Judéofuturisme

Démonstration de `@auto-essay/core` utilisé comme **moteur neutre**, avec un
profil personnel chargé comme **données** (jamais compilé dans le moteur).

## Fichiers

- `project.json` — le profil `EssayProject` (problématique, voix, catalogue).
- `concepts.json` — les `Concept` du projet.
- `tensions.json` — les `Tension` du projet.
- `bibliography.bib` — la bibliographie (illustrative, à remplacer par la tienne).
- `run.ts` — script qui charge les données, ingère la biblio et découvre les relations.

## Lancer

```bash
npm run build:core             # compile le moteur vers dist/
npm run example:judeofuturisme # exécute run.ts
```

## Modifier (sans toucher au moteur)

- La **problématique** → `project.json` (`argumentMap.centralQuestion`).
- Le **vocabulaire d'analyse** → `concepts.json` / `tensions.json`.
- La **bibliographie** → `bibliography.bib`.
- Le **ton / la voix** → `project.json` (`voiceConfig`).

Aucun de ces contenus n'est compilé dans le moteur : ils sont chargés au runtime.
La bibliographie est illustrative ; remplace-la par tes propres références.
