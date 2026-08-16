# ADR-003 : Migration vers Literacraft

## Statut

Accepté

## Contexte

La première itération du pipeline gérait la rédaction paragraphe par paragraphe, avec une évaluation documentaire globale. Elle ne formalisait pas suffisamment le lien entre *matière* (sources, claims, relations) et *forme* (opérations stylistiques, effets recherchés).

## Décision

Nous avons introduit un sous-système **Literacraft** inspiré de Litfract :

- **Observation** : décrire une opération stylistique observée dans un corpus de référence.
- **Articulation** : proposer une opération stylistique motivée par une relation entre contenus.
- **Décision éditoriale** : valider ou rejeter l'articulation avec des engagements explicites.
- **Projection juge / écrivain** : compiler la décision en directives indépendantes.
- **Trace de transformation** : lier chaque unité rédigée aux directives qui l'ont produite.

La migration conserve les modules historiques (évaluation documentaire, vérifications mécaniques) et les enrichit d'une couche éditoriale relationnelle.

## Conséquences

- Le plan éditorial est désormais séparable de son exécution.
- L'évaluation documentaire et l'évaluation éditoriale sont indépendantes : une réussite formelle ne compense pas une faille argumentative.
- Le code héberge temporairement des démonstrateurs qui simulent les réponses LLM pour garantir la reproductibilité des tests.

## Alternatives rejetées

- **Prompts monolithiques** : moins traçables et moins testables.
- **Abandon du pipeline paragraphe** : la granularité reste utile pour les tests et les démonstrations rapides.
