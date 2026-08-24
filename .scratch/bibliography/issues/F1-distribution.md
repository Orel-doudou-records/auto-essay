# F1 — Distribution bibliographique (projection)

## Contexte

« On a un manuscrit et un plan ; l'ingestion distribue les éléments qui
répondent aux chapitres ou aux paragraphes. » Les scopes existent déjà
(ADR-006 : `sectionId`/`paragraphId` = ids de nœuds) et le plan est dans les
nœuds (chantier E). Il manque le lien sources ↔ scopes.

## Objectif

Projeter les sources vers les scopes du manuscrit : `distributeBibliography`
(associer) + `projectBibliography` (consommer) — à la manière de
`projectBookState` / `projectBookPlan`.

## Changements proposés

- `BibliographyDistribution` (domaine) : `{ sourceId, scopeId (id de nœud), rationale?, confidence? }`
  + schéma + validation (scopeId doit exister dans l'arbre, comme
  `resolveScopeNodeIds`).
- `distributeBibliography(manuscript, profiles, client?)` : deux modes —
  (a) **pur** : matching mots-clés/`subjects` ↔ titre/texte des nœuds,
  zéro token ; (b) **assisté** : un appel par chapitre propose la distribution.
- `projectBibliography(manuscript, distribution)` : par scope, la liste des
  sources pertinentes → injectée au lecteur diffractif quand il rédige un
  paragraphe de ce scope (réutilise `BookPlanEntryInput`/entrées de plan).
- Export + CLI de démo sur le manuscrit judéofuturisme.

## Vérifications

- Tests : validation (scopeId inconnu refusé), mode pur (matching déterministe),
  mode assisté (fake client), projection par scope.
- Typecheck complet (core + api) avant merge.