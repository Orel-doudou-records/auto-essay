# Architecture du moteur

Ce document explique l'organisation du code, les responsabilités de chaque module et les flux de données entre eux.

## Vue d'ensemble des modules

Le moteur est structuré en six modules fonctionnels, plus un module de domaine partagé.

```
src/
├── domain/        # Types métier, schémas Zod, règles de validation
├── state/         # Machine à états et registry déterministe
├── ingestion/     # Import de sources (Markdown, BibTeX)
├── evaluation/    # Vérifications mécaniques et évaluation LLM
├── revision/      # Génération de briefs de révision
└── pipeline/      # Orchestration de la génération par granularité
```

## Domaine

Le cœur du système. Définit les entités, leurs contraintes et leurs règles de cohérence.

| Fichier | Entité principale | Rôle |
|---------|-------------------|------|
| `essayProject.ts` | `EssayProject` | Conteneur global, carte argumentative, voix |
| `draftUnit.ts` | `DraftUnit` | Unité de rédaction avec evidence pack et scores |
| `claim.ts` | `Claim` | Assertion traçable avec niveau de confiance |
| `source.ts` | `Source` | Document importé avec annotations |
| `evaluation.ts` | `EssayEvaluation` | Résultat d'évaluation et seuils |
| `pipelineState.ts` | `EssayState` | État du pipeline et transitions |
| `revision.ts` | `RevisionBrief` | Instructions de révision et manifest de livraison |

Toutes les entités sont validées par **Zod** à la création. Cela garantit que les données circulant dans le système respectent toujours le contrat.

## État

Gère la persistance et les transitions de phase.

### `StateMachine`

Orchestre le pipeline. Elle ne contient pas de logique métier (rédaction, évaluation) mais garantit que les opérations se déroulent dans le bon ordre.

Responsabilités :
- Créer et charger l'état
- Transitionner entre les phases (unidirectionnelles)
- Incrémenter les compteurs (itérations, cycles)
- Mettre à jour les scores
- Gérer les dettes
- Vérifier l'invariant `Exécuter → Vérifier → Rendre`

### `Registry`

Gestion des versions canoniques. Déterministe et immuable.

Responsabilités :
- Publier une version (sauvegarde + metadata)
- Lister l'historique
- Rollback vers une version antérieure
- Calculer un hash de contenu

## Ingestion

Transforme des documents bruts en `Source` structurées.

### `importers.ts`

- **`importMarkdown`** : parse le frontmatter YAML, extrait les citations en bloc (`> ...`), crée les `Annotation`.
- **`importBibTeX`** : parse les entrées `@article`, `@book`, `@inproceedings`, mappe les champs vers `Source`.

Aucun appel réseau n'est effectué ici. L'ingestion est purement synchrone et déterministe.

## Évaluation

Système dual : mécanique d'abord, LLM ensuite.

### `mechanicalChecks.ts`

Vérifications sans intelligence artificielle. Rapides, reproductibles, gratuites.

- `detectStrongAssertions` : repère les mots de forte assertion (`démontre`, `prouve`) sans citation proche
- `detectMissingCitations` : signale les faits numériques ou les références aux "études" sans source
- `detectFillerPhrases` : liste les phrases de remplissage
- `detectTransitionOveruse` : compte la densité des connecteurs logiques
- `checkCitationFormat` : détecte les parenthèses mal fermées ou les années isolées
- `detectUnclearBoundaries` : repère les passages qui confondent fait et interprétation

### `evaluateEssay.ts`

Évaluateur "judge model".

1. Exécute les vérifications mécaniques
2. Si erreurs critiques : retourne immédiatement un score bas (3.0)
3. Sinon : construit un prompt détaillé pour le LLM
4. Parse la réponse JSON
5. Fusionne les faiblesses mécaniques avec celles du LLM

Le juge est **read-only** : il ne modifie jamais le texte, il ne fait que mesurer.

## Révision

### `genBrief.ts`

Transforme une `EssayEvaluation` en `RevisionBrief` actionnable.

Algorithme interne :
1. Trier les 6 dimensions par score croissant
2. Garder les 3 plus faibles comme `focusAreas`
3. Générer des instructions selon le verdict
4. Mapper les `evidenceGaps`, `overclaimRisks` et `citationGaps` vers des tâches concrètes

## Pipeline

### `paragraphMode.ts`

Génère du contenu paragraphe par paragraphe.

- Construit un prompt structuré à partir de l'`EvidencePack`
- Attend une réponse JSON stricte
- Parse et valide la sortie
- Retourne un `ParagraphGenerationResult`

Les modes `section`, `chapter` et `book` existent dans la roadmap mais ne sont pas encore implémentés.

## Flux de données typique

```
[Utilisateur]
    ↓
createEssayProject() → EssayProject
    ↓
importMarkdown() → Source[]
    ↓
createDraftUnit() → DraftUnit
    ↓
ParagraphGenerator.generateParagraph() → ParagraphGenerationResult
    ↓
unit.content = result.content
    ↓
EssayEvaluator.evaluate() → EssayEvaluation
    ↓
RevisionBriefGenerator.generateBrief() → RevisionBrief
    ↓
[Itération ou publication]
    ↓
Registry.publishVersion() → VersionEntry
```

## Séparation des préoccupations

| Module | Ne fait pas | Fait |
|--------|-------------|------|
| `domain` | Pas d'appel réseau | Validation, règles métier |
| `state` | Pas de génération de texte | Orchestration, persistance |
| `ingestion` | Pas d'évaluation | Transformation de formats |
| `evaluation` | Pas de modification du texte | Mesure, diagnostic |
| `revision` | Pas de réécriture | Planification des corrections |
| `pipeline` | Pas de jugement de qualité | Génération structurée |

## Voir aussi

- [Référence : API](../reference/api.md)
- [Explication : Le juge et l'écrivain](juge-ecrivain.md)
- [Explication : Granularités de rédaction](granularites.md)
