# F3 — Diffraction organique de la bibliographie

## Contexte

« Quand on diffracte, tout devient organique, et la distribution bibliographie
peut se modifier. » La lecture diffractive reçoit déjà l'état du livre
(`bookParts`), les coupes (`existingCuts`) et le plan (`bookPlan` avec
`planImpacts`). Il manque le canal bibliographique.

## Objectif

La diffraction peut proposer de **redistribuer** la bibliographie — déplacer
une source vers un autre chapitre, rapprocher deux sources, signaler une source
manquante — sous forme de **projection re-projetable** (jamais de mutation
destructive du graphe ni de la bibliothèque).

## Changements proposés

- `BookBibliographyInput` dans `diffractiveReader.ts` : la distribution du
  scope en cours, formatée en texte compact (sources + profils, pas le corpus).
- Sortie `bibliographyImpacts` : `{ sourceId?, scopeId?, impact, kind:
  redistribuer | rapprocher | manquante }` — optionnel, comme `planImpacts`
  (pas de nouveau verdict).
- `applyBibliographyImpacts(distribution, impacts)` : fusion pure → nouvelle
  distribution (trace conservée).
- CLI : `diffract` accepte `--bibliography library.json` (ou similaire) et
  rend les impacts.

## Vérifications

- Tests : prompt (distribution formatée), schéma `bibliographyImpacts`,
  application pure (ids inconnus filtrés), rétro-compatibilité (sans
  bibliographie → pas d'impacts).
- Typecheck complet (core + api) avant merge.