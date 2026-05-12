# Référence : Formats de sortie

Ce document décrit les schémas JSON attendus par le moteur pour les entrées et sorties structurées.

## Génération de paragraphe

### Prompt attendu par le modèle

Voir `ParagraphGenerator.buildParagraphPrompt` dans `src/pipeline/paragraphMode.ts`.

### Sortie JSON attendue

```json
{
  "plan_3_sentences": [
    "Phrase décrivant le mouvement 1",
    "Phrase décrivant le mouvement 2",
    "Phrase décrivant le mouvement 3"
  ],
  "paragraph": "Texte du paragraphe entre 180 et 220 mots...",
  "claims": [
    {
      "statement": "Assertion factuelle extraite",
      "confidenceLevel": "certain|probable|speculative|unsupported",
      "sourceIds": ["uuid-de-la-source"]
    }
  ],
  "confidence_assessment": "high|medium|low"
}
```

| Champ | Type | Contraintes |
|-------|------|-------------|
| `plan_3_sentences` | `string[]` | Exactement 3 éléments |
| `paragraph` | `string` | 180-220 mots |
| `claims` | `object[]` | Assertions déclaratives |
| `confidence_assessment` | `string` | Énumération à 3 valeurs |

## Évaluation

### Prompt attendu par le juge

Voir `EssayEvaluator.buildEvaluationPrompt` dans `src/evaluation/evaluateEssay.ts`.

### Sortie JSON attendue

```json
{
  "overallScore": 7.2,
  "dimensions": {
    "claimSupport": 7.0,
    "citationIntegrity": 8.5,
    "counterargumentQuality": 6.0,
    "transitionClarity": 7.5,
    "scopeControl": 7.0,
    "voiceConsistency": 8.0
  },
  "weaknesses": [
    {
      "dimension": "counterargumentQuality",
      "description": "L'objection principale est évoquée mais pas réfutée.",
      "severity": "major",
      "location": "Paragraphe 2",
      "suggestedFix": "Ajouter une phrase de réfutation avec source."
    }
  ],
  "strongClaims": ["Assertion bien soutie"],
  "weakClaims": ["Assertion trop générale"],
  "aiPatternsDetected": ["Tournure générique"],
  "overclaimRisks": [
    {
      "claim": "Les réseaux sociaux détruisent la démocratie.",
      "location": "Phrase 3",
      "issue": "unsupported_generalization",
      "severity": "major",
      "suggestion": "Nuancer : 'contribuent à fragiliser'"
    }
  ],
  "top3Revisions": [
    {
      "priority": 1,
      "target": "Objection principale",
      "issue": "Non réfutée",
      "approach": "Citer un contre-exemple étudié."
    }
  ],
  "newClaimEntries": [
    {
      "statement": "Nouvelle assertion à tracer",
      "sourceIds": ["uuid"],
      "confidenceLevel": "probable"
    }
  ],
  "evidenceGaps": [
    {
      "claim": "Affirmation sans preuve",
      "location": "Paragraphe 1",
      "missingEvidence": "Données quantitatives sur l'usage",
      "priority": "high"
    }
  ],
  "citationGaps": [
    {
      "statement": "Selon les études récentes...",
      "location": "Phrase 5",
      "expectedSource": "Nom de l'étude",
      "priority": "medium"
    }
  ],
  "verdict": "keep|keep_with_minor_edits|revise|discard",
  "evaluatedAt": "2024-01-15T10:00:00Z",
  "evaluatorModel": "gpt-4-evaluator"
}
```

## Frontmatter Markdown

Les fichiers sources Markdown doivent respecter ce format :

```markdown
---
title: "Titre de l'œuvre"
author: "Nom Prénom"           # ou ["Auteur 1", "Auteur 2"]
date: "2024"
doi: "10.xxxx/xxxxx"
url: "https://..."
tags: ["tag1", "tag2"]
source: "chemin/vers.pdf"
---

Corps du texte...

> Citation avec page (p. 12)

> Autre citation (p. 45-46)
```

| Champ | Type | Requis |
|-------|------|--------|
| `title` | `string` | Non (défaut = nom du fichier) |
| `author` | `string \| string[]` | Non |
| `date` | `string` | Non |
| `doi` | `string` | Non |
| `url` | `string` | Non |
| `tags` | `string[]` | Non |
| `source` | `string` | Non |

## BibTeX

Le parser supporte les entrées suivantes :

```bibtex
@article{clef,
  author  = {Prénom Nom},
  title   = {Titre},
  journal = {Revue},
  year    = {2024},
  doi     = {10.xxxx/xxxxx},
}

@book{clef,
  author    = {Prénom Nom},
  title     = {Titre},
  publisher = {Éditeur},
  year      = {2024},
}
```

Les champs extraits sont : `author`, `title`, `journal`, `year`, `doi`, `url`, `publisher`, `abstract`.

## Voir aussi

- [Référence : API](api.md)
- [Comment ingérer des sources](../how-to/ingerer-sources.md)
- [Comment générer des paragraphes](../how-to/generer-paragraphes.md)
