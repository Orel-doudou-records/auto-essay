# Plan V2 — architecture livrée

Plan V2 est la couche de cognition de planification d’AutoEssay. Il n’introduit pas un second arbre de livre ni un second moteur d’exécution.

## Autorités

- **Structure canonique : `Manuscript.tree`**. Toute structure validée du livre y vit. Les propositions de décomposition et les diffs sont transitoires jusqu’au checkpoint auteur.
- **Sémantique de planification : `PlanningBrief`**. C’est le seul nouvel agrégat durable de Plan V2. Il est versionné par scope et conserve question, hypothèses, lacunes, contraintes et références de sources.
- **Exécution : `EditorialPlan`**. Il reste le contrat downstream du Writer/Judge. `compilePlanningScopeToEditorialPlan` est un adaptateur local et n’élargit pas son modèle avec les concepts de Plan.
- **Lecture des conséquences : Diffract**. `refineExistingPlan` et `reviewPlanningChangeImpacts` réutilisent le lecteur diffractif existant ; aucun moteur d’impact Plan parallèle n’est canonique.
- **Corpus : contenu documentaire existant**. L’exploration Plan V2 consomme des passages/contenus avec provenance. Une couverture partielle reste explicitement partielle : « non trouvé » ne signifie jamais « absent du corpus ».
- **Writing Engine : frontière collaborative générique**. AutoEssay garde ses sémantiques de Plan. Aucun `PlanningWorkspace`, `PlanningSession` ou primitive Writing Engine spécifique à AutoEssay n’est requis par Plan V2.

## Parcours auteur livré

Dans l’espace **Plan** existant :

1. **Explorer** le corpus et obtenir des axes/sujets gradués par fondation documentaire.
2. **Préciser** un `PlanningBrief`; le grill est borné et dérivé, jamais une session persistante.
3. **Proposer une structure** adaptative, avec hypothèses concurrentes et lacunes explicites.
4. Préparer un diff lisible. Aucune mutation de `Manuscript.tree` n’a lieu avant l’acte auteur.
5. **Valider** ou refuser/éditer le diff. L’application validée est atomique au niveau domaine.
6. Lorsqu’un scope est localement prêt, le compiler vers l’`EditorialPlan` existant.
7. Après changement d’un brief, Diffract cible les scopes à revalider ; aucun texte ni plan d’exécution n’est réécrit automatiquement.

## Objets transitoires ou dérivés

Restent non persistants : sujets candidats, axes, readiness, questions de grill, propositions de décomposition, diagnostics de raffinement, diffs structurels et classifications d’impact. Les lacunes et hypothèses sont des valeurs du `PlanningBrief`, pas des agrégats autonomes.

## Invariants de sûreté éditoriale

- corpus first : le modèle ne remplace jamais une preuve manquante ;
- une lacune peut rester ouverte sans empêcher tout le livre d’avancer ;
- les hypothèses peuvent rester concurrentes, contestées ou sous-documentées ;
- la readiness est locale et observable ;
- les changements structurels exigent un checkpoint auteur ;
- les changements amont provoquent une revalidation ciblée, jamais une réécriture automatique ;
- un plan existant est conservé par défaut et transformé différentiellement.

## Différé explicitement

Plan V2 ne prétend pas livrer une ingestion bibliographique profonde et exhaustive. La promotion d’un `CorpusExplorer`/PageIndex mature reste un chantier séparé. Une adoption plus profonde du lifecycle Writing Engine est également différée jusqu’à ce qu’un besoin soit réellement commun à AutoEssay et AutoFiction. Ces chantiers ne doivent pas modifier les autorités décrites ci-dessus sans décision architecturale explicite.
