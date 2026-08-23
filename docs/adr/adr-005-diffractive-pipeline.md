# ADR-005 — Pipeline permanent : la lecture diffractive nourrit la décision

Statut : accepté
Date : 2026-08-24

## Contexte

Le « moteur de pensée » (méthode diffractive, ADR-004) produit des
`DiffractiveReading` en isolation via la CLI. Pour que le moteur avance
réellement le manuscrit, il faut un chemin **permanent et réutilisable** qui
relie la lecture diffractive à la décision éditoriale — sans jamais
court-circuiter la validation auteur.

## Décision

On introduit deux services d'orchestration dans `@auto-essay/core`, qui
**composent** les opérateurs existants au lieu de les remplacer :

1. `DiffractiveBatchRunner` (`src/editorial/diffractiveBatch.ts`)
   - Diffracte **plusieurs fragments** contre le même livre/concepts/tensions.
   - Séquentiel (respecte les quotas), ordonné, **résilient** : l'échec d'un
     fragment est collecté (`failures`), le lot continue.
   - Prend un `StructuredModelClient`, comme `DiffractiveReader`.

2. `DiffractivePipeline` (`src/editorial/diffractivePipeline.ts`)
   - Chaîne complète : `diffract` → `attachReading` → `accept` → décision.
   - `diffract` : fragment + livre → `DiffractiveReading` (délègue au lecteur).
   - `attachReading` : attache la lecture à une `ContentStyleArticulation`
     (immutable, statut conservé).
   - `accept` : l'auteur valide une articulation candidate → `EditorialDecision`
     (délègue à `EditorialDecisionService`), la coupe `cut` étant dérivée de
     `diffractiveReading.pass4`.
   - `runFragment` : le chemin complet en un appel.

## Séparation des rôles

- `RelationAnalyzer` → `ContentRelation[]` (matière).
- `ArticulationResolver` → `ContentStyleArticulation[]` candidates (à partir de
  relations + observations). **Reste en amont du pipeline** : le pipeline
  consomme une articulation déjà résolue, il ne la fabrique pas.
- `DiffractiveReader` → `DiffractiveReading` (trace de raisonnement).
- `DiffractivePipeline` → colle la lecture à l'articulation, puis décide.
- `EditorialDecisionService` → gouvernance auteur (immuable, avec événements).

La validation auteur reste un **verrou humain** : le pipeline produit des
candidats et une décision seulement quand l'articulation passe par `accept`.
Le verdict diffractif est une recommandation ; la décision est l'engagement.

## Conséquences

- Positif : le moteur est utilisable en production (API/route), testable avec
  un client injecté, et le flux complet est explicite.
- Négatif : `DiffractivePipeline` n'orchestre pas l'`ArticulationResolver` ;
  l'appelant doit fournir l'articulation candidate. Ce découplage est voulu
  pour garder chaque opérateur focalisé et testable.
