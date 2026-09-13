# Chantier F — Bibliothèque — HISTORIQUE / SUPERSEDED

Cette spécification décrit l’ancienne architecture de bibliothèque centrée sur Graphify, un `SourceProfile` construit à partir de métadonnées et une distribution statique `sourceId → scopeId`.

Elle **n’est plus l’architecture cible** d’AutoEssay.

## Autorité actuelle

Le chantier **Corpus V2** est défini par la SPEC GitHub **#212** et ses tickets #213–#222.

Chaîne documentaire actuelle :

```text
Source
  → IngestedDocument
  → SourceProfile + Comprehension Closure
  → CorpusSynthesis / CorpusExplorer
  → RetrievedPassage
  → Citation + ContentRelation
  → projection documentaire calculée par scope
  → EditorialPlan / EvidencePack
  → Writer / Judge
```

Invariants :

- `Source` porte l’identité bibliographique/épistémique ; le contenu canonique appartient à `IngestedDocument`.
- Les blocs/spans de `IngestedDocument` sont l’autorité documentaire ; index/chunks éventuels restent dérivés.
- `SourceProfile` est dérivé et reconstruit depuis le contenu ingéré ; il ne remplace jamais le document canonique.
- Une synthèse corpus-first exige la **Comprehension Closure** des sources actives, sauf exclusion explicite.
- `CorpusSynthesis` est transitoire/reconstruisible ; il n’existe pas de `CorpusMap` canonique.
- `CorpusExplorer` distingue `exploration` et `corroboration` et rematérialise toujours le texte depuis `IngestedDocument`.
- `Citation` porte la provenance documentaire vérifiée ; `ContentRelation` porte la fonction argumentative. Il n’existe pas d’entité canonique `Evidence`.
- La distribution cognitive statique par mots-clés est supprimée. La matière documentaire d’un scope est une projection calculée et passage-aware.
- `BibliographyDistributionEntry[]` subsiste uniquement comme **format de compatibilité de lecture** pour les workspaces persistés antérieurs à Corpus V2 ; il n’est plus produit par le core et n’est pas une autorité cognitive.
- Graphify a été retiré du chemin runtime lors du cutover #222.

## PageIndex

Le verdict du benchmark #221 est documenté dans :

`docs/architecture/CORPUS_V2_PAGEINDEX_BENCHMARK.md`

Verdict actuel : **REJECT** pour l’intégration runtime PageIndex tant qu’un gain same-corpus sur les critères AutoEssay (exploration, contradiction, qualification, singularité, provenance) n’est pas démontré.

## Plan V2

Les autorités de planification restent celles de `docs/architecture/PLAN_V2.md` :

- `Manuscript.tree` : structure canonique du livre ;
- `PlanningBrief` : intention éditoriale durable ;
- `EditorialPlan` : contrat d’exécution Writer/Judge ;
- Diffract : moteur unique de lecture diffractive, sans retrieval corpus caché.

Ce fichier est conservé uniquement pour l’historique des décisions. Toute nouvelle évolution de la bibliothèque doit partir de Corpus V2/#212, pas de l’ancienne spécification F.
