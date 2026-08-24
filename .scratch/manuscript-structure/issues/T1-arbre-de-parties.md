# T1 — L'arbre de parties (Manuscript)

**Bloqué par :** rien (démarrable immédiatement)

## Contexte

ADR-006 (docs/adr/adr-006-etat-du-livre-en-cours.md) décisions acceptées + spec
D (docs/specs/d-manuscript-structure.md). User stories 1–6, 11.

Aujourd'hui `Manuscript` = liste plate `units[]` (unitId + version + order).
Les `EditorialScope` pointent vers des ids de sections inexistants. Le
manuscrit doit devenir un **arbre de parties** à profondeur libre.

## Livrable

- `src/domain/manuscript.ts` : nouvel arbre —
  - `ManuscriptLeaf`: `{ kind: "leaf", unitId, version }` (feuille = référence
    à une version précise d'unité).
  - `ManuscriptNode`: `{ kind: "node", id, title, text?, children: (node|leaf)[] }`
    (profondeur libre, texte propre optionnel = préambule d'acte).
  - `Manuscript`: `{ id, projectId, title, tree: (node|leaf)[], createdAt,
    updatedAt }` — **plus de champ `order`** : la position dans le tableau EST
    l'ordre.
  - Validation zod (superRefine) : ids de nœuds **uniques sur tout l'arbre** ;
    références d'unité **non dupliquées** (même unitId+version deux fois
    interdites ; versions différentes du même unitId acceptées).
  - Factory `createManuscript` (timestamps/id générés, `tree` par défaut `[]`,
    jamais écrasables par l'appelant) + helpers `createManuscriptNode`,
    `createManuscriptLeaf` + helpers de parcours `collectNodeIds`,
    `collectLeafReferences` (ordre du parcours = ordre de profondeur).
- `src/export/manuscriptExport.ts` : adapter le compilateur — parcours de
  l'arbre en ordre : nœud → titre (en-tête markdown `#`/`##`… puis texte
  propre le cas échéant), feuille → contenu de l'unité résolue. La boucle
  citations/sources traite les feuilles dans l'ordre de l'arbre. Garder
  `resolveUnit` et le reste (APA, ranges) inchangés.
- `tests/manuscript.test.ts` : réécrire — création d'arbre, nœuds/feuilles
  mixtes, texte propre optionnel, profondeur libre, ids dupliqués rejetés,
  références dupliquées rejetées, versions différentes acceptées, arbre vide
  par défaut, champs générés non écrasables.

## Contrat

- `createManuscript`, `ManuscriptSchema` restent exportés (même noms).
- `ManuscriptUnitReference` / `ManuscriptUnitReferenceSchema` disparaissent
  (aucun consommateur hors tests — vérifier par grep avant).
- Suite core + api + web verte, typecheck propre.

## Pièges connus

- Fichiers avec accents français : écrire via le tool `write` (UTF-8) dans le
  staging puis `Copy-Item` (jamais de réécriture via PowerShell affiché).
- EOL : les fichiers du repo sont CRLF — les nouveaux fichiers peuvent être LF,
  git normalisera (warning bénin).
- Schémas récursifs zod : types déclarés avant les schémas, `z.lazy` pour le
  nœud, `z.union` (pas discriminatedUnion) pour l'enfant.
## Statut : ✅ livré (PR #49, merge 22a71f4)

