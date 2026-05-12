# Système dual d'évaluation

Ce document explique comment les deux systèmes d'évaluation — mécanique et LLM — se complètent pour garantir la qualité argumentative.

## Immune System 1 : Mécanique

Objectif : détecter les défauts évidents, rapides à identifier, sans coût de tokens.

### Détecteurs implémentés

#### Assertions fortes sans citation (`detectStrongAssertions`)

Liste des mots surveillés :
- `démontre`, `prouve`, `établit`, `confirme`, `vérifie`, `certifie`
- `affirme définitivement`, `sans aucun doute`, `il est certain que`

Logique : si un de ces termes apparaît sans citation dans les 100 caractères suivants, un warning est émis. La suggestion propose des termes prudents (`suggère`, `indique`, `semble`).

#### Citations manquantes (`detectMissingCitations`)

Patterns déclencheurs :
- Années isolées (`\d{4}`)
- Pourcentages (`\d+%`)
- "Selon les études", "La recherche a montré"
- "En 2024"

Logique : si le contexte (±80 caractères) ne contient pas de pattern de citation valide, un `info` est émis.

#### Phrases de remplissage (`detectFillerPhrases`)

Liste des patterns regex :
- `il est important de noter que`
- `force est de constater que`
- `comme nous l'avons vu`
- `ce qui nous amène à`
- `en d'autres termes`, `pour faire simple`

Logique : suppression ou reformulation recommandée.

#### Surutilisation de transitions (`detectTransitionOveruse`)

Transitions surveillées : `cependant`, `toutefois`, `néanmoins`, `par ailleurs`, `de plus`, `en outre`, `ainsi`, `par conséquent`, `en effet`.

Seuil : > 1 % du total des mots. Un paragraphe de 200 mots ne devrait pas utiliser plus de 2 fois la même transition.

#### Format de citations (`checkCitationFormat`)

Détecte :
- Parenthèses mal fermées `(Auteur 2023` sans `)`
- Années isolées `(2023)` sans auteur
- `p.` sans numéro

#### Frontières floues (`detectUnclearBoundaries`)

Détecte :
- `ce qui prouve que`
- `cela signifie que`
- `il est évident que`

Suggestion : modaliser (`suggère`, `indique`, `pourrait signifier`) ou citer.

### Tolérance

```typescript
passesMechanicalChecks(text, maxErrors = 0, maxWarnings = 5);
```

Par défaut, aucune erreur n'est tolérée et 5 warnings maximum sont acceptés.

## Immune System 2 : LLM (Judge Model)

Objectif : évaluer la qualité argumentative avec une compréhension sémantique.

### Dimensions évaluées

Voir [Référence : Système d'évaluation](../reference/evaluation.md) pour le détail des scores.

### Prompt

Le prompt d'évaluation (`buildEvaluationPrompt`) fournit au juge :
- Le contenu complet de l'unité
- La liste des sources utilisées
- Les claims attendues
- La voix essayistique configurée

Le juge doit retourner un JSON strict avec scores, faiblesses, risques et verdict.

### Fusion des résultats

```typescript
// Étape 1 : Mécanique
const mechanical = passesMechanicalChecks(unit.content, 0, 10);

// Étape 2 : Si pas d'erreur critique, appel LLM
const evaluation = await evaluator.evaluate(context);

// Étape 3 : Merge
evaluation.weaknesses = [...evaluation.weaknesses, ...mechanicalIssues];
```

Les faiblesses mécaniques sont injectées dans le résultat final pour que le brief de révision les traite comme n'importe quelle autre faiblesse.

## Pourquoi deux systèmes ?

| Critère | Mécanique | LLM |
|---------|-----------|-----|
| **Vitesse** | Instantanée | Lente (appel réseau) |
| **Coût** | Gratuit | Coûteux (tokens) |
| **Reproductibilité** | Totale | Variable (température, modèle) |
| **Portée** | Patterns fixes | Compréhension contextuelle |
| **Biais** | Aucun | Possible (indulgence) |

Le système mécanique agit comme un **filtre rapide** : il rejette les textes manifestement inadéquats avant de consommer des ressources LLM. Le système LLM apporte la **nuance** que les regex ne peuvent pas capturer (qualité de la réfutation, subtilité des transitions, cohérence de la voix).

## Voir aussi

- [Référence : Système d'évaluation](../reference/evaluation.md)
- [Explication : Le juge et l'écrivain](juge-ecrivain.md)
- [Comment évaluer et réviser](../how-to/evaluer-reviser.md)
