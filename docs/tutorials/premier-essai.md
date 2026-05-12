# Tutoriel : Votre premier essai

Ce tutoriel vous guide pas à pas dans la création d'un premier essai avec le moteur `auto-essay`. À la fin, vous aurez produit un projet structuré, importé des sources, généré un paragraphe argumenté, évalué sa qualité et compris le cycle de révision.

> **Prérequis** : Node.js 20+, npm installé, et un éditeur de texte. Vous devez avoir exécuté `npm install` à la racine du projet.

---

## Étape 1 : Créer un projet

Un projet essayistique est le conteneur de tout votre travail : thèse, sources, unités de rédaction et paramètres de voix.

Créez un fichier `first-essay.ts` :

```typescript
import { createEssayProject } from "@auto-essay/core";

const project = createEssayProject({
  title: "L'impact des réseaux sociaux sur le débat public",
  thesisSeed: "Les algorithmes de recommandation fragmentent l'espace public en créant des chambres d'écho...",
  contextScope: "France et États-Unis, 2010-2024",
  periodOrField: "Science politique / Médias",
});

console.log("Projet créé :", project.id);
console.log("Titre :", project.title);
```

La fonction `createEssayProject` génère automatiquement un identifiant unique (`crypto.randomUUID()`), les dates de création et de modification, et initialise les listes vides (`claims`, `sourceIds`, `draftUnitIds`).

---

## Étape 2 : Initialiser la state machine

La state machine pilote le pipeline en garantissant l'ordre des phases et l'invariant `Exécuter → Vérifier → Rendre`.

```typescript
import { createStateMachine } from "@auto-essay/core";

const stateMachine = createStateMachine("./.auto-essay");
const state = await stateMachine.initialize(project.id);

console.log("Phase actuelle :", state.phase); // "intake"
```

L'état est persisté automatiquement dans `./.auto-essay/{projectId}/essay_state.json`. Vous pouvez le recharger plus tard avec `stateMachine.getState(project.id)`.

---

## Étape 3 : Importer des sources

Le moteur accepte plusieurs formats. Commençons par un fichier Markdown avec frontmatter YAML.

Créez un fichier `source.md` :

```markdown
---
title: "L'ère de la désinformation"
author: "Cass Sunstein"
date: "2017"
doi: "10.1086/example"
tags: ["réseaux sociaux", "chambres d'écho"]
---

> Les individus qui ne communiquent qu'avec des partisans ont tendance à devenir plus extrémistes. (p. 12)

> L'exposition sélective est un phénomène bien documenté en psychologie sociale. (p. 45)
```

Puis importez-le :

```typescript
import { importMarkdown } from "@auto-essay/core";
import fs from "fs";

const markdownContent = fs.readFileSync("source.md", "utf-8");
const source = importMarkdown("source.md", markdownContent, project.id);

console.log("Source importée :", source.title);
console.log("Annotations :", source.annotations.length); // 2
```

Le moteur a extrait automatiquement les deux citations en bloc (`> ...`) comme annotations, avec les numéros de page.

---

## Étape 4 : Créer une unité de rédaction

Une `DraftUnit` représente une unité de travail (ici, un paragraphe). Elle embarque un `evidencePack` qui liste les sources et citations à utiliser.

```typescript
import { createDraftUnit } from "@auto-essay/core";

const unit = createDraftUnit({
  projectId: project.id,
  granularity: "paragraph",
  thesis: "Les algorithmes de recommandation fragmentent l'espace public en créant des chambres d'écho",
  evidencePack: {
    sourceIds: [source.id],
    keyCitations: [
      {
        sourceId: source.id,
        quote: "Les individus qui ne communiquent qu'avec des partisans ont tendance à devenir plus extrémistes.",
        pageRange: "12",
      },
    ],
    authorNotes: "Insister sur le mécanisme psychologique, pas seulement technique.",
  },
});

console.log("Unité créée :", unit.id);
console.log("Objectif de mots :", unit.targetWordCount); // 200 (par défaut pour paragraph)
```

---

## Étape 5 : Générer un paragraphe

Le générateur de paragraphes construit un prompt structuré et attend une réponse JSON du modèle de langage.

> **Prérequis** : vous devez implémenter un `StructuredModelClient`. Voici un exemple fictif :

```typescript
import { createParagraphGenerator } from "@auto-essay/core";

const mockClient = {
  async generateJson(prompt: string) {
    // Dans un cas réel, appelez OpenAI/Anthropic avec response_format: { type: "json_object" }
    return {
      plan_3_sentences: [
        "Définir le phénomène des chambres d'écho algorithmiques.",
        "Citer Sunstein sur l'extrémisation des partisans isolés.",
        "Conclure sur le risque démocratique de fragmentation.",
      ],
      paragraph: "Les algorithmes de recommandation... [texte de 180-220 mots]",
      claims: [
        {
          statement: "Les chambres d'écho renforcent l'extrémisme politique.",
          confidenceLevel: "probable",
          sourceIds: [source.id],
        },
      ],
      confidence_assessment: "high",
    };
  },
};

const generator = createParagraphGenerator(mockClient);
const result = await generator.generateParagraph(unit.evidencePack, [source], {
  section: "Introduction",
  thesis: project.thesisSeed,
});

console.log("Paragraphe généré :\n", result.content);
```

Le résultat contient :
- `content` : le texte du paragraphe
- `plan` : le plan en 3 phrases
- `claims` : les assertions extraites avec leur niveau de confiance
- `confidenceAssessment` : l'évaluation globale de solidité

---

## Étape 6 : Évaluer la qualité

L'évaluateur fonctionne en deux étapes : vérifications mécaniques (sans LLM), puis évaluation critique (judge model).

```typescript
import { createEssayEvaluator } from "@auto-essay/core";

// Mettre à jour le contenu de l'unité
unit.content = result.content;
unit.claimIds = []; // Dans un cas réel, créez les claims avec createClaim()

const evaluator = createEssayEvaluator(mockClient, "gpt-4-evaluator");
const evaluation = await evaluator.evaluate({
  unit,
  sources: [source],
  claims: [],
});

console.log("Score global :", evaluation.overallScore);
console.log("Verdict :", evaluation.verdict);
console.log("Faiblesses :", evaluation.weaknesses.length);
```

Si le verdict est `discard` ou `revise`, le paragraphe doit être retravaillé. Si le score est supérieur à 6.0 (`KEEP_THRESHOLD`), il peut être conservé.

---

## Étape 7 : Générer un brief de révision

Lorsque l'évaluation révèle des axes d'amélioration, le générateur de briefs transforme automatiquement les faiblesses en instructions actionnables.

```typescript
import { createRevisionBriefGenerator } from "@auto-essay/core";

const briefGen = createRevisionBriefGenerator();
const brief = briefGen.generateBrief(evaluation, unit);

console.log("Zones de focus :", brief.focusAreas.map((f) => f.dimension));
console.log("Instructions :", brief.specificInstructions);
```

Le brief identifie les 3 dimensions les plus faibles (par exemple `claimSupport`, `citationIntegrity`) et propose des corrections concrètes : ajouter des preuves, renforcer des assertions, corriger des sur-assertions.

---

## Étape 8 : Transitionner vers l'export

Quand toutes les unités sont validées, la state machine peut passer en phase `export`.

```typescript
// Marquer comme vérifié (prérequis pour l'export)
await stateMachine.markVerified(project.id);

// Transitionner
const exportState = await stateMachine.transitionToPhase(project.id, "export");
console.log("Nouvelle phase :", exportState.phase);
```

> **Invariant** : La transition vers `export` est rejetée si `lastVerifiedAt` n'est pas défini. Cela garantit qu'aucun livrable ne part sans vérification.

---

## Récapitulatif

Vous avez appris à :

1. Créer un projet avec `createEssayProject`.
2. Initialiser et persister l'état avec `createStateMachine`.
3. Importer des sources Markdown avec `importMarkdown`.
4. Créer une unité de rédaction avec `createDraftUnit`.
5. Générer un paragraphe avec `createParagraphGenerator`.
6. Évaluer la qualité avec `createEssayEvaluator`.
7. Produire un brief de révision avec `createRevisionBriefGenerator`.
8. Transitionner vers l'export en respectant les invariants.

**Prochaine étape** : consultez les [guides pratiques](../how-to/) pour approfondir chaque phase.
