# T2 — Statut dérivé + projecteur d'état

**Bloqué par :** T1 (l'arbre de parties)

## Contexte

ADR-006 décisions 4, 9 ; spec D user stories 4, 5, 7, 8, 9, 13. Le lecteur
diffractif (D-lite, PR #48) consomme `BookPartInput[]` (`{ id, title, status,
text }`, status = `DraftUnitStatus`, text vide = partie planifiée).

## Livrable

- `src/domain/manuscriptStatus.ts` (ou dans manuscript.ts) : **échelle de
  faiblesse** des statuts pour la dérivation — ex. drafting < revising <
  reviewing < verified < published (archivé traité à part) — et fonction pure
  `deriveNodeStatus(node, resolveUnitStatus): DraftUnitStatus` : statut d'un
  nœud non-feuille = le plus faible de ses descendants ; feuille = statut de la
  version référencée (injecté via resolveur, sans I/O).
- `src/editorial/projectBookState.ts` : **projecteur pur**
  `projectBookState(manuscript, resolveLeaf): BookPartInput[]` —
  - parcourt l'arbre en ordre ;
  - une `BookPartInput` par nœud porteur de texte (texte propre OU feuille) ;
  - `text` vide → partie planifiée (pas d'omission) ;
  - `status` résolu via la dérivation ;
  - ne dépend d'aucune I/O (resolveur injecté).
- Tests : échelle/faiblesse, dérivation (chapitre avec enfant ébauche →
  ÉBAUCHE ; tous vérifiés → RÉDIGÉ), projecteur (arbre mixte ordonné, nœud
  avec préambule, partie planifiée vide, statuts français).

## Contrat

Fonctions pures exportées depuis `@auto-essay/core` (index editorial/domain).

## Pièges connus

- Traiter `archived` dans l'échelle sans casser la dérivation (documenter le
  choix : archivé = force le statut du parent si présent, sinon ignoré).
- Le statut des parties planifiées (aucun enfant, aucun texte) : décider et
  documenter (proposition : `drafting` par défaut).