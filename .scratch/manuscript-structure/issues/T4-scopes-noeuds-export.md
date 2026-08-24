# T4 — Scopes sur nœuds (EditorialScope) + bouclage export

**Bloqué par :** T1 (l'arbre de parties)

## Contexte

Spec D user stories 10. Les `EditorialScope` (`sectionId`/`paragraphId`
optionnels dans `EditorialScopeSchema`, src/domain/contentRelation.ts) pointent
vers des adresses qui n'existaient pas ; les ids de nœuds de l'arbre deviennent
les valeurs canoniques.

## Livrable

- Vérifier `EditorialScopeSchema` + usages (articulationResolver, plans,
  scopes démo/exemples) : les `sectionId`/`paragraphId` fournis correspondent
  désormais à des ids de nœuds de manuscrit (documenter le contrat ; pas de
  résolution au parse si hors périmètre).
- Bouclage : démo/exemples alignés (le scope des plans existants référence des
  nœuds réels si applicable), tests de cohérence (un scope valide référence un
  id de nœud existant quand un manuscrit est fourni).

## Contrat

Suite verte, typecheck propre. Ne PAS construire de résolveur d'arbres dans le
parse (les scopes restent des adresses ; la résolution est un service).

## Pièges connus

- Ne pas casser les tests d'articulation existants qui utilisent des
  `sectionId` arbitraires ({sectionId: "section-1"} etc.) — le contrat doit
  rester rétro-compatible pour les scopes sans manuscrit associé.
## Statut : ✅ livré (PR #51, merge d634e25)

