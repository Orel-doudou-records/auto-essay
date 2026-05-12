# Comment évaluer et réviser

Ce guide explique comment juger la qualité d'une unité de rédaction, interpréter les verdicts et appliquer les briefs de révision.

## Lancer une évaluation

L'évaluateur combine deux systèmes : une vérification mécanique rapide et une évaluation LLM critique.

```typescript
import { createEssayEvaluator } from "@auto-essay/core";

const evaluator = createEssayEvaluator(client, "gpt-4-evaluator");

const evaluation = await evaluator.evaluate({
  unit,
  sources: [source1, source2],
  claims: allClaims.filter((c) => unit.claimIds.includes(c.id)),
  voice: project.voiceConfig,
});
```

### Ordre des opérations internes

1. **Vérifications mécaniques** : si des erreurs critiques sont détectées, l'évaluation retourne immédiatement un score bas (3.0) et le verdict `revise`.
2. **Prompt d'évaluation** : le juge reçoit le contenu, les sources, les claims et la voix attendue.
3. **Fusion** : les faiblesses mécaniques sont ajoutées aux faiblesses détectées par le LLM.

## Interpréter les scores

L'évaluation produit un score global et six scores dimensionnels, tous sur 10.

| Dimension | Seuil critique | Seuil acceptable |
|-----------|----------------|------------------|
| `claimSupport` | < 5 | ≥ 7 |
| `citationIntegrity` | < 5 | ≥ 7 |
| `counterargumentQuality` | < 5 | ≥ 7 |
| `transitionClarity` | < 5 | ≥ 7 |
| `scopeControl` | < 5 | ≥ 7 |
| `voiceConsistency` | < 5 | ≥ 7 |

```typescript
import { QUALITY_THRESHOLDS, meetsQualityThreshold } from "@auto-essay/core";

console.log("Score global :", evaluation.overallScore);
console.log("Passe le seuil ?", meetsQualityThreshold(evaluation)); // ≥ 6.0
```

## Comprendre les verdicts

| Verdict | Signification | Action recommandée |
|---------|---------------|--------------------|
| `keep` | Parfait ou quasi-parfait | Publier tel quel |
| `keep_with_minor_edits` | Bon, quelques ajustements | Corriger les éditions mineures |
| `revise` | Problèmes substantiels | Suivre le brief de révision |
| `discard` | Inacceptable | Réécrire complètement |

## Générer et appliquer un brief de révision

```typescript
import { createRevisionBriefGenerator } from "@auto-essay/core";

const briefGen = createRevisionBriefGenerator();
const brief = briefGen.generateBrief(evaluation, unit);

console.log("Priorité 1 :", brief.focusAreas[0].dimension, brief.focusAreas[0].description);
console.log("Sur-assertions à corriger :", brief.overclaimsToFix.length);
console.log("Preuves à ajouter :", brief.evidenceToAdd.length);
```

### Structure d'un brief

- **`focusAreas`** : les 3 dimensions les plus faibles, triées par priorité.
- **`specificInstructions`** : instructions actionnables (ex. *"Corriger 2 sur-assertions"*).
- **`evidenceToAdd`** : gaps de preuve identifiés par le juge.
- **`claimsToStrengthen`** : assertions jugées trop faibles.
- **`overclaimsToFix`** : sur-assertions avec suggestion de correction.
- **`citationsToAdd`** : citations manquantes à intégrer.
- **`objectionsToAddress`** : objections à traiter ou nuancer.

## Détecter un plateau

Si après plusieurs cycles de révision le score n'augmente plus, il est inutile de continuer.

```typescript
import { hasPlateaued } from "@auto-essay/core";

const plateau = hasPlateaued(currentEvaluation, previousEvaluation);
// true si |score - score précédent| < 0.3
```

La state machine limite automatiquement les cycles de révision à 6 maximum (`MAX_REVISION_CYCLES`).

## Gérer les retries par unité

Si une unité est jugée `discard`, vous pouvez la régénérer. Le moteur limite à 5 tentatives par unité (`MAX_UNIT_ATTEMPTS`).

```typescript
if (evaluation.verdict === "discard") {
  if (state.iteration < 5) {
    await stateMachine.incrementIteration(project.id);
    // Relancer la génération
  } else {
    console.error("Limite de tentatives atteinte pour cette unité.");
  }
}
```

## Voir aussi

- [Générer des paragraphes](generer-paragraphes.md)
- [Référence : Système d'évaluation](../reference/evaluation.md)
- [Explication : Système dual d'évaluation](../explanation/systeme-evaluation.md)
