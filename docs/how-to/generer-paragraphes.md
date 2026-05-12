# Comment générer des paragraphes

Ce guide montre comment produire du contenu argumenté unité par unité, en respectant les contraintes du moteur.

## Prérequis

Vous devez disposer d'un `StructuredModelClient`. C'est une interface que vous implémentez pour brancher le moteur sur OpenAI, Anthropic ou tout autre fournisseur capable de retourner du JSON.

```typescript
import type { StructuredModelClient } from "@auto-essay/core";

const client: StructuredModelClient = {
  async generateJson(prompt: string) {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
    return JSON.parse(response.choices[0].message.content!);
  },
};
```

## Générer un paragraphe en mode PARAGRAPHE

```typescript
import { createParagraphGenerator } from "@auto-essay/core";

const generator = createParagraphGenerator(client);

const result = await generator.generateParagraph(
  unit.evidencePack,
  [source1, source2],
  {
    section: "Introduction",
    precedingText: "Le débat sur la laïcité a resurgi dans les années 2000...",
    thesis: project.thesisSeed,
  }
);

console.log(result.content);
console.log(result.confidenceAssessment); // "high" | "medium" | "low"
```

### Contraintes appliquées par le prompt

Le prompt construit par `ParagraphGenerator` impose au modèle :

1. **180-220 mots exactement**
2. **Maximum 2 citations directes**
3. **Toutes les citations doivent provenir de l'evidence pack**
4. **Distinguer fait / interprétation / hypothèse**
5. **Pas d'assertion forte sans source solide** (interdiction de *démontre*, *prouve*, etc.)

### Format de sortie attendu

```json
{
  "plan_3_sentences": ["Phrase 1", "Phrase 2", "Phrase 3"],
  "paragraph": "Texte du paragraphe...",
  "claims": [
    {
      "statement": "Assertion extraite",
      "confidenceLevel": "probable",
      "sourceIds": ["uuid-source"]
    }
  ],
  "confidence_assessment": "high"
}
```

## Vérifier la conformité mécanique

Avant d'envoyer au juge, vous pouvez vérifier le texte avec les contrôles mécaniques :

```typescript
import { runMechanicalChecks } from "@auto-essay/core";

const issues = runMechanicalChecks(result.content);

for (const issue of issues) {
  console.log(`[${issue.severity}] ${issue.type}: ${issue.message}`);
  console.log(`  Suggestion : ${issue.suggestion}`);
}
```

Les contrôles détectent :
- **Assertions fortes sans citation** (`démontre`, `prouve`, `sans aucun doute`...)
- **Faits potentiels sans source** (années, pourcentages, "selon les études"...)
- **Phrases de remplissage** (`il est important de noter que`, `force est de constater que`...)
- **Surutilisation de transitions** (`cependant`, `toutefois`, `de plus`...)
- **Format de citations incorrect**
- **Frontières fait/interprétation floues**

## Associer le contenu à l'unité

```typescript
unit.content = result.content;
unit.claimIds = result.claims.map((c) => {
  const claim = createClaim({
    projectId: project.id,
    statement: c.statement,
    confidenceLevel: c.confidenceLevel,
    sourceIds: c.sourceIds,
    claimType: "interpretation",
    scope: "paragraph",
  });
  return claim.id;
});
```

## Anti-patterns

- **Ne pas envoyer le paragraphe à l'évaluation sans l'associer à l'unité** : l'évaluateur lit `unit.content`.
- **Ne pas remplir `evidencePack.sourceIds`** : le prompt listera "Aucune source", et le modèle inventera des citations.
- **Ne pas vérifier le nombre de mots** : `meetsWordCountTarget(unit)` vérifie si le texte respecte l'objectif ±20 %.

## Voir aussi

- [Évaluer et réviser](evaluer-reviser.md)
- [Référence : Formats de sortie](../reference/formats-sortie.md)
- [Explication : Le juge et l'écrivain](../explanation/juge-ecrivain.md)
