# Le juge et l'écrivain

Ce document explique pourquoi le moteur sépare strictement la génération de texte de son évaluation, et pourquoi cette séparation est fondamentale pour la qualité essayistique.

## Le problème de l'auto-évaluation

Quand un même modèle de langage rédige un texte puis l'évalue, il souffre d'un biais systémique :

1. **Biais de confirmation** : le modèle tend à valider ses propres choix.
2. **Biais d'auto-justification** : il trouve des raisons post-hoc pour défendre ses formulations.
3. **Cécité aux patterns** : il ne détecte pas ses tics de langage car il les reproduit naturellement.
4. **Sur-assertion** : il surestime la solidité de ses propres arguments.

Ce phénomène est bien documenté dans les systèmes d'écriture automatique. C'est pourquoi `auto-essay` applique le principe de **séparation juge/écrivain**.

## Deux rôles, deux modèles

### L'écrivain (Writer)

- **Responsabilité** : produire du contenu argumenté à partir d'un evidence pack.
- **Contraintes** : respecter le nombre de mots, les citations, la distinction fait/interprétation.
- **Ce qu'il ne fait pas** : il ne juge pas la qualité de sa production.

Dans le code, l'écrivain est représenté par le `ParagraphGenerator` (et à terme les générateurs section/chapitre/livre).

### Le juge (Judge)

- **Responsabilité** : mesurer la qualité argumentative du texte produit.
- **Contraintes** : être critique, ne pas indulger, signaler les faiblesses.
- **Ce qu'il ne fait pas** : il ne réécrit pas le texte.

Dans le code, le juge est représenté par l'`EssayEvaluator`.

## L'évaluateur comme boîte noire

```typescript
// L'agent (écrivain) ne peut pas modifier les critères
const evaluation = await evaluator.evaluate({ unit, sources, claims, voice });

// Il peut seulement lire le verdict et adapter sa stratégie
if (evaluation.verdict === "discard") {
  // Relancer la génération avec un prompt différent
}
```

Les critères d'évaluation sont codés en dur dans le prompt du juge (`buildEvaluationPrompt`). L'écrivain ne les voit pas et ne peut pas les contourner. Seul l'opérateur humain peut modifier les critères en modifiant le code source.

## Système immunitaire à deux étages

La séparation juge/écrivain est complétée par une première ligne de défense purement mécanique :

1. **Immune System 1 (Mécanique)** : `runMechanicalChecks` détecte les sur-assertions, les citations manquantes et les phrases de remplissage **sans appel LLM**. C'est rapide, gratuit et impartial.
2. **Immune System 2 (LLM)** : le juge évalue la qualité argumentative avec une compréhension contextuelle.

Si le système 1 détecte des erreurs critiques, le système 2 n'est même pas appelé. Cela économise des tokens et évite de donner au juge une occasion de "rationaliser" des défauts évidents.

## Conséquences sur le pipeline

- Une unité peut être générée, évaluée, jugée `discard`, puis régénérée avec un brief différent. L'écrivain n'a aucune mémoire de ses échecs précédents (sauf via le brief).
- Le juge peut être remplacé ou affiné indépendamment de l'écrivain. Vous pouvez utiliser un modèle léger pour l'écrivain et un modèle puissant pour le juge.
- Les évaluations sont stockées et comparables. Vous pouvez mesurer l'amélioration au fil des cycles.

## Analogie

Imaginez un journal scientifique :
- **L'auteur** soumet un article.
- **Le comité de relecture** (juge) évalue à l'aveugle.
- L'auteur ne connaît pas l'identité des relecteurs et ne peut pas les contacter pour négocier son score.
- Les relecteurs ne réécrivent pas l'article, ils émettent des recommandations.

`auto-essay` reproduit cette architecture pour garantir l'objectivité.

## Voir aussi

- [Explication : Système dual d'évaluation](systeme-evaluation.md)
- [Explication : Architecture du moteur](architecture.md)
- [Comment évaluer et réviser](../how-to/evaluer-reviser.md)
