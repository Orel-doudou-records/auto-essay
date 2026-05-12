# Comment configurer un projet

Ce guide montre comment cadrer un projet essayistique, choisir la granularité de rédaction et définir la voix du texte.

## Créer un projet avec un périmètre clair

La fonction `createEssayProject` exige au minimum un `title`. Enrichissez les champs optionnels pour obtenir des résultats plus cohérents :

```typescript
import { createEssayProject } from "@auto-essay/core";

const project = createEssayProject({
  title: "La laïcité à l'épreuve des communautarismes",
  thesisSeed: "La loi de 1905, conçue comme un pacte républicain, est aujourd'hui instrumentalisée...",
  contextScope: "France contemporaine, débats juridiques et sociologiques",
  periodOrField: "Science politique",
});
```

| Champ | Rôle | Exemple |
|-------|------|---------|
| `title` | Titre du projet (obligatoire) | `"La laïcité..."` |
| `thesisSeed` | Hypothèse initiale | `"La loi de 1905..."` |
| `contextScope` | Périmètre intellectuel et géographique | `"France, débats juridiques"` |
| `periodOrField` | Discipline ou époque | `"Science politique"` |

## Choisir une granularité

Le moteur supporte quatre niveaux. En MVP, seul le mode `paragraph` est entièrement opérationnel.

| Granularité | Objectif de mots | Usage |
|-------------|------------------|-------|
| `paragraph` | 200 mots (±20 %) | Fragment argumentatif ciblé |
| `section` | 1 200 mots | Section complète avec sous-parties |
| `chapter` | 5 000 mots | Chapitre avec carte argumentative |
| `book` | 50 000 mots | Architecture globale d'un ouvrage |

```typescript
import { createDraftUnit } from "@auto-essay/core";

const paragraph = createDraftUnit({
  projectId: project.id,
  granularity: "paragraph",
});

const section = createDraftUnit({
  projectId: project.id,
  granularity: "section",
  targetWordCount: 1500, // surcharge la valeur par défaut
});
```

## Configurer la voix essayistique

La voix définit le ton, la densité et les contraintes stylistiques du texte. Passez-la lors de l'évaluation pour que le juge vérifie la cohérence.

```typescript
import { EssayVoiceSchema } from "@auto-essay/core";

const voice = EssayVoiceSchema.parse({
  tone: "academic",
  density: "dense",
  person: "third",
  passiveVoice: "minimal",
  readerPromise: "Je vous montrerai que la laïcité est un processus historique, non un état figé.",
  stylisticReferences: ["Pierre Rosanvallon", "Jean Baubérot"],
  constraints: ["Pas de première personne du pluriel", "Éviter le présent de narration"],
});

// Associer au projet
project.voiceConfig = voice;
```

| Propriété | Valeurs possibles | Impact |
|-----------|-------------------|--------|
| `tone` | `academic`, `journalistic`, `literary`, `personal`, `polemical` | Ton général |
| `density` | `light`, `moderate`, `dense`, `technical` | Niveau de sophistication |
| `person` | `first`, `third` | Point de vue narratif |
| `passiveVoice` | `avoid`, `minimal`, `acceptable`, `preferred` | Tolérance au passif |

## Valider le contexte avec la state machine

Après le cadrage, passez en phase `sourcing` pour indiquer que le projet est prêt à recevoir des documents.

```typescript
const stateMachine = createStateMachine();
await stateMachine.initialize(project.id);
await stateMachine.transitionToPhase(project.id, "sourcing");
```

## Anti-patterns à éviter

- **Ne pas laisser `thesisSeed` vide** : une graine de thèse floue produit des paragraphes sans direction.
- **Ne pas mélanger les granularités sans plan** : générer un paragraphe comme s'il était une section crée des ruptures de registre.
- **Ne pas ignorer `voiceConfig`** : sans voix définie, l'évaluateur ne peut pas vérifier la cohérence stylistique.

## Voir aussi

- [Ingérer des sources](ingerer-sources.md)
- [Générer des paragraphes](generer-paragraphes.md)
- [Référence : API](../reference/api.md)
