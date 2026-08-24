# T1 — Plan d'ébauche et notes dans le domaine

**Feature** : book-plan · **Bloqué par** : rien (spec E, chantier D livré).

## Objectif
`ManuscriptNode` porte un plan d'ébauche et un fil de notes :
`plan?: PlanEntry[]` (liste ordonnée, position = ordre) + `notes?: PlanNote[]`.
`PlanEntry { id, subject, preview?, notes? }` ; `PlanNote { kind: human|agent, text, createdAt }`.

## Contrat
- `PlanEntrySchema` / `PlanNoteSchema` exportés depuis `@auto-essay/core` ;
- `ManuscriptNode` (type + input + schéma) accepte `plan`/`notes` **optionnels**
  (les nœuds existants restent valides) ;
- ids d'entrées de plan **uniques au sein d'un nœud** (superRefine) ;
- factories : `createPlanEntry(subject, partial?)`, `createPlanNote(kind, text)`,
  `createManuscriptNode` accepte `plan`/`notes` ;
- aucun changement de parcours (`collectNodeIds`/`collectLeafReferences` ignorants du plan).

## Démo
Construire un chapitre avec le plan réel du Chap 2 judéofuturisme (Le salon →
Abikou et le rêve prémonitoire) + une note agent, validé par le schéma ;
un id d'entrée dupliqué → `safeParse` échoue.

## Pièges connus
- Écriture UTF-8 via `write` + `Copy-Item` (accents) ;
- tests zod : `toEqual` (re-parse) ; `.mjs` sans `return` top-level ;
- ne PAS rendre `plan`/`notes` obligatoires (rétro-compatibilité D).
## Statut : ✅ livré (PR #52, merge ec6bb5e)

