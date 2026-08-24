# F2 — Citation classique reliée à la distribution

## Contexte

La base citation existe déjà : `createClaim` avec `sourceIds`, `CitationSchema`
(trace source → claim → citation). Il manque le lien entre la **distribution**
(F1) et les citations émises par les paragraphes écrits (chantier E, E4).

## Objectif

Un paragraphe rédigé (lié à son entrée de plan) cite les sources de son scope,
avec provenance complète : source → profil → claim → citation (auteur, année,
page). La trace doit être réversible jusqu'à l'ouvrage (exigence du brief).

## Changements proposés

- Relier `PlanEntry.unitId/unitVersion` (E4) aux citations : un paragraphe écrit
  déclare `citationIds` ou `claimIds` sourcés par sa distribution.
- `assertCiteable(unit, distribution, citations)` : refuse une citation dont la
  source n'est pas dans la distribution du scope (garde pure).
- Formatage citation : `(Auteur, année)` / note de bas de page, depuis `Source`.
- Exemple judéofuturisme : le Chap 2 réel (plan.json) avec les .ris Zotero
  ingérés (F0) comme sources.

## Vérifications

- Tests : garde pure (source hors distribution refusée), formateur, traçabilité
  paragraphe → claim → source.
- Typecheck complet (core + api) avant merge.
## Statut : ✅ livré (PR #58, merge f6c1353)

