# Spec D — La structure du manuscrit et le projecteur d'état

Date : 2026-08-24 · Source : ADR-006 (accepté) · Statut : prêt pour tickets

## Problem Statement

Le lecteur diffractif juge le manuscrit en cours comme un texte fini : rien
dans le domaine ne représente la structure du livre (actes/chapitres/sections)
ni le statut de chaque partie (ébauche, rédigé, planifié). `Manuscript` est une
liste plate d'unités, et les `EditorialScope` (`sectionId`/`paragraphId`)
pointent vers des adresses qui n'existent pas comme objets. Résultat : l'état
du livre (« bookParts ») doit être assemblé à la main, et le modèle inventé des
positions.

## Solution

`Manuscript` devient un **arbre de parties** (profondeur libre) : chaque nœud
porte un titre, un texte propre optionnel (préambule d'acte) et des enfants ;
les feuilles référencent une `DraftUnit` (`unitId + version`). Le statut d'un
nœud non-feuille est **dérivé** (le plus faible de ses descendants), celui
d'une feuille vient de la version référencée. La position dans l'arbre est
l'ordre (plus de champ `order` plat). Un **projecteur pur**
`Manuscript → BookPartInput[]` produit la forme canonique que consomme le
lecteur diffractif (D-lite, PR #48).

## User Stories

1. En tant qu'auteur, je veux que mon manuscrit soit un arbre d'actes/chapitres/
   sections, afin que chaque partie du livre ait une place stable.
2. En tant qu'auteur, je veux qu'une partie porte un titre et un texte propre
   optionnel, afin qu'un préambule d'acte puisse exister sans unité factice.
3. En tant qu'auteur, je veux qu'une partie planifiée (pas encore écrite) soit
   un état légitime, afin que le lecteur sache que cet emplacement attend son
   fragment.
4. En tant qu'auteur, je veux que les feuilles référencent une version précise
   d'unité, afin que le statut lu soit celui de la version pointée.
5. En tant qu'auteur, je ne veux pas maintenir le statut d'un chapitre à la
   main : il se déduit de ses enfants.
6. En tant qu'auteur, je ne veux pas maintenir d'ordre séparé : la position
   dans l'arbre fait foi.
7. En tant que moteur diffractif, je veux un projecteur pur du manuscrit vers
   les `bookParts`, afin d'injecter l'état du chantier sans fichiers JSON
   manuels.
8. En tant que moteur diffractif, je veux que le projecteur produise les
   libellés de statut français (ÉBAUCHE, RÉDIGÉ (validé), …), afin que la
   section « État du livre en cours » du prompt soit correcte.
9. En tant que moteur diffractif, je veux qu'une partie sans texte ni unité
   soit projetée « (pas encore écrit) », afin de ne pas la faire passer pour
   un texte vide accidentel.
10. En tant que développeur, je veux que les `EditorialScope` référencent de
    vrais nœuds, afin que `sectionId`/`paragraphId` pointent vers des objets.
11. En tant qu'auteur, je veux que l'exemple judéofuturisme soit migré vers
    l'arbre, afin que la démo montre le nouveau modèle.
12. En tant qu'auteur, je veux pouvoir passer le manuscrit structuré au
    diffract (CLI/API) et recevoir des verdicts sensibles à l'ébauche.
13. En tant qu'auteur, je veux qu'un chapitre dont un enfant est en ébauche
    soit lu comme ÉBAUCHE, afin que le verdict tienne compte du réel.

## Implementation Decisions

- **Arbre de parties** : nouveau modèle `Manuscript` = nœuds `{ id, title,
  text?, children[] }`, feuille `{ unitId, version }` ; profondeur libre ;
  l'ordre est l'ordre du tableau.
- **Échelle de statut** : ordre de « faiblesse » pour la dérivation non-feuille
  (ébauche < révision < vérifié < publié ; archivé traité à part). Le statut
  d'un nœud = le plus faible de ses descendants.
- **Projecteur pur** `projectBookState(manuscript, resolveUnit)` :
  parcours en ordre, une `BookPartInput` par nœud porteur de texte (propre ou
  feuille), statut résolu, `text` vide = partie planifiée. Fonction sans I/O.
- **Identité des nœuds** : les ids des nœuds deviennent les valeurs canoniques
  référencées par les `EditorialScope` (section/paragraph).
- **Forme canonique** : `BookPartInput` (D-lite) reste la cible ; le projecteur
  produit exactement ce format.
- **Migration** : l'exemple judéofuturisme (project.json, run.ts) passe à
  l'arbre ; les usages de la forme plate de `Manuscript` sont migrés ou
  supprimés (contraction).

## Testing Decisions

- Bon test = comportement externe : un manuscrit donné + des unités données →
  les `bookParts` projetés, ordonnés, avec statuts dérivés et libellés
  français corrects ; une partie planifiée → `text` vide projeté.
- Modules testés : le modèle arbre (validation, factory) et le projecteur
  (cas nominaux + bords : manuscrit vide, nidification profonde, nœud mixte
  avec texte propre, feuilles aux statuts variés).
- Prior art : `tests/manuscript.test.ts` (validation du modèle actuel),
  `tests/diffractiveBookState.test.ts` (D-lite), style des tests de domaine
  core (zod + factory).

## Out of Scope

- Attachement des plans (`EditorialPlan`) aux nœuds non-feuilles (fonction
  argumentative) — décidé possible mais branché dans un chantier séparé.
- Surcharge explicite du statut d'assemblage (décidé : dérivé pur).
- CRUD d'édition du manuscrit (routes API) — le modèle + projecteur d'abord.
- Persistance des fragments/coupes (autre chantier).

## Further Notes

- Le grill (ADR-006) est terminé : toutes les décisions de modélisation sont
  actées. Le découpage en tickets est proposé à part (to-tickets) et sera
  affiné après exploration des consommateurs de `Manuscript`.