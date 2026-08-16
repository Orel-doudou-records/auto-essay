# ADR-001 : Séparation juge / écrivain

## Statut

Accepté

## Contexte

Un agent de rédaction autonome doit pouvoir itérer sur son propre texte. Si le même modèle évalue ce qu'il produit, il a un intérêt structurel à confirmer ses choix plutôt qu'à les critiquer.

## Décision

Nous séparons explicitement deux rôles :

- **Writer** : génère du texte, applique des directives éditoriales, expose des traces de transformation.
- **Judge** : évalue le texte selon des critères fixes, sans accéder aux intentions du writer au-delà des traces publiées.

Les deux rôles sont matérialisés par des projections différentes (`WriterEditorialProjection` vs `EvaluatorEditorialProjection`) compilées à partir du même plan validé.

## Conséquences

- L'évaluateur peut rejeter une exécution formellement correcte si les claims ne sont pas suffisamment soutenus.
- Le writer ne peut pas optimiser son score en satisfaisant des critères documentaires par des artifices stylistiques.
- L'architecture introduit une duplication de projection, mais elle est justifiée par l'indépendance des rôles.

## Alternatives rejetées

- **Auto-évaluation par le writer** : plus simple, mais invalide l'objectif de contrôle externe.
- **Évaluateur humain unique** : non reproductible et non automatisé.
