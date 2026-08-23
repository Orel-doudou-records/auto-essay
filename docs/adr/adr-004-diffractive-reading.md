# ADR-004 : Lecture diffractive comme trace de raisonnement

## Statut

Accepté

## Contexte

Literacraft proposait déjà des articulations (`ContentStyleArticulation`) et
des décisions (`EditorialDecision`), mais le raisonnement qui relie un fragment
à une décision n'était pas modélisé. L'ancien `DiffractiveStylePlan` traitait
la diffraction comme un profil réutilisable, ce qui a été retiré (pierre
tombale `styleProfile.ts`).

## Décision

Réintroduire la méthode diffractive (Haraway/Barad, opérationnalisée par
`abehmiel/diffract`) comme **trace de raisonnement**, pas comme profil :

- `DiffractiveReading` : quatre passes (fragment à travers le livre, livre à
  travers le fragment, enchevêtrements, coupe agentielle) + verdict forcé.
- Le verdict (`integrate_now` / `adapt_differently` / `incubate` / `archive` /
  `discard`) remplace le « ça dépend ».
- La coupe agentielle nomme les exclusions, y compris celles de la
  non-décision.

La lecture diffractive enrichit `ContentStyleArticulation` (champ
`diffractiveReading`, optionnel pour rétrocompatibilité) ; la coupe enrichit
`EditorialDecision` (champ `cut`). Aucun nouvel objet canonique autonome.

## Conséquences

- La diffraction est une matière, jamais une décision : l'auteur reste la
  seule autorité de validation.
- Les passes peuvent produire « pas de réfraction non-évidente » (liste vide),
  pour résister à l'insight synthétique.
- La rétrocompatibilité est préservée : les articulations sans lecture
  diffractive restent valides.

## Alternatives rejetées

- **Nouvel objet canonique `Fragment`** : les `Claim`/`Source` existants
  suffisent ; un nouvel objet dupliquerait la couche.
- **Verdict sur `EditorialDecision`** : le verdict est une recommandation issue
  de la lecture ; la décision est l'engagement de l'auteur. Les deux restent
  distincts.
