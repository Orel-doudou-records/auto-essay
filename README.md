# @auto-essay/core

Moteur essayistique — Agent de rédaction d'essais avec pipeline itératif, séparation juge/écrivain et validation déterministe.

```
┌─────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌────────┐   ┌────────┐
│ Intake  │ → │ Sourcing │ → │ Planning │ → │ Drafting │ → │ Review │ → │ Export │
└─────────┘   └──────────┘   └──────────┘   └──────────┘   └────────┘   └────────┘
```

## Caractéristiques

- **Pipeline reproductible** : du cadrage au livrable, chaque phase est traçable et versionnée.
- **Séparation juge/écrivain** : le modèle qui évalue n'est jamais celui qui rédige.
- **Vérifications mécaniques** : détection des sur-assertions, citations manquantes et phrases de remplissage sans appel LLM.
- **State machine déterministe** : transitions de phase contrôlées, invariant `Exécuter → Vérifier → Rendre`.
- **Registry immuable** : chaque version publiée est conservée, avec possibilité de rollback.
- **Granularité réglable** : paragraphe, section, chapitre ou livre entier.

## Structure

Ce dépôt est organisé en workspace npm :

- `@auto-essay/core` (racine) : moteur métier, schémas Zod, pipeline et évaluation.
- `@auto-essay/api` (`apps/api`) : serveur local Hono qui expose une API REST/SSE.
- `@auto-essay/web` (`apps/web`) : interface graphique React/Vite connectée à l'API.

## Démarrage rapide

```bash
# Installation des dépendances
npm install

# Lancer le serveur API et le frontend en parallèle
npm run dev
```

L'API est disponible sur `http://localhost:3000` et le frontend sur `http://localhost:5173`.

Les données locales sont stockées dans `~/.auto-essay/` (variable `AUTO_ESSAY_DATA_DIR` pour changer).

Pour utiliser un modèle de langage externe, définissez `OPENAI_API_KEY`. Sans clé, un client mock retourne des réponses factices.

## Exemple minimal

```typescript
import {
  createEssayProject,
  createDraftUnit,
  createStateMachine,
  createParagraphGenerator,
  createEssayEvaluator,
  createRevisionBriefGenerator,
  importMarkdown,
} from "@auto-essay/core";

// 1. Créer un projet
const project = createEssayProject({
  title: "La liberté de la presse sous la Restauration",
  thesisSeed: "La censure napoléonienne a laissé des traces structurelles...",
  contextScope: "France, 1814-1830",
});

// 2. Initialiser la state machine
const stateMachine = createStateMachine();
await stateMachine.initialize(project.id);

// 3. Importer une source
const source = importMarkdown(
  "rosanvallon-2000.md",
  fs.readFileSync("rosanvallon-2000.md", "utf-8"),
  project.id
);

// 4. Créer une unité de rédaction
const unit = createDraftUnit({
  projectId: project.id,
  granularity: "paragraph",
  evidencePack: {
    sourceIds: [source.id],
    keyCitations: [
      { sourceId: source.id, quote: "La liberté politique naît de la société civile..." },
    ],
  },
});

// 5. Générer un paragraphe (nécessite un client LLM structuré)
const generator = createParagraphGenerator(myOpenAiClient);
const result = await generator.generateParagraph(unit.evidencePack, [source]);
```

## Documentation

- **[Tutoriel : Votre premier essai](docs/tutorials/premier-essai.md)** — Apprenez le moteur en produisant un essai complet de A à Z.
- **Guides pratiques**
  - [Configurer un projet](docs/how-to/configurer-projet.md)
  - [Ingérer des sources](docs/how-to/ingerer-sources.md)
  - [Générer des paragraphes](docs/how-to/generer-paragraphes.md)
  - [Évaluer et réviser](docs/how-to/evaluer-reviser.md)
  - [Exporter un livrable](docs/how-to/exporter-livrable.md)
- **Référence technique**
  - [API publique](docs/reference/api.md)
  - [State machine](docs/reference/state-machine.md)
  - [Système d'évaluation](docs/reference/evaluation.md)
  - [Formats de sortie](docs/reference/formats-sortie.md)
- **Explications conceptuelles**
  - [Architecture du moteur](docs/explanation/architecture.md)
  - [Le juge et l'écrivain](docs/explanation/juge-ecrivain.md)
  - [Système dual d'évaluation](docs/explanation/systeme-evaluation.md)
  - [Granularités de rédaction](docs/explanation/granularites.md)

## Scripts disponibles

| Commande | Description |
| --- | --- |
| `npm run dev` | API + frontend en développement |
| `npm run dev:api` | API seule |
| `npm run dev:web` | Frontend seul |
| `npm run typecheck` | Vérification TypeScript de tout le workspace |
| `npm run lint` | Lint ESLint de tout le workspace |
| `npm test` | Tests du core |
| `npm run test:api` | Tests de l'API |
| `npm run test:web` | Tests du frontend |
| `npm run build` | Build du core, de l'API et du frontend |

## Architecture

```
src/
├── domain/        # Types métier, schémas Zod et règles pures
├── editorial/     # Planification, décisions, projections juge/écrivain
├── evaluation/    # Évaluateur read-only et vérifications mécaniques
├── ingestion/     # Import Markdown, BibTeX
├── pipeline/      # Modes paragraph et section
├── revision/      # Génération de briefs relationnels
└── state/         # Registry déterministe et machine à états

apps/api/src/
├── routes/        # Endpoints REST
├── services/      # Couche de persistance (lecture/écriture .auto-essay)
├── llm/           # Client LLM OpenAI-compatible + mock
└── middleware/    # Validation Zod, gestion d'erreurs, CORS

apps/web/src/
├── routes/        # Écrans React
├── hooks/         # Hooks d'appels API
├── api/           # Client API
└── components/    # Composants UI
```

## Principes directeurs

1. **Tester à l'échelle du paragraphe, architecturer pour toutes les granularités.**
2. **Claim ledger au centre** : aucune assertion non vérifiée en publication.
3. **Séparation juge/écrivain** : modèle d'évaluation différent du modèle de rédaction.
4. **Exécuter → Vérifier → Rendre** : pas de livraison sans vérification préalable.
5. **Sorties structurées** : JSON strict, pas de markdown flou.

## État du projet

Ce moteur est en phase MVP. Les fonctionnalités suivantes sont opérationnelles :

- [x] Schémas métier (`Source`, `Claim`, `DraftUnit`, `EssayProject`)
- [x] State machine + registry déterministe
- [x] Ingestion Markdown et BibTeX
- [x] Mode paragraphe (prompt + pipeline)
- [x] Vérifications mécaniques (anti-overclaim)
- [x] Évaluateur read-only
- [x] Reviewer distinct + briefs
- [x] Tests unitaires passants
- [x] API locale Hono
- [x] Interface web React (beta)

Fonctionnalités à venir :

- [ ] Export Pandoc/PDF/ZIP
- [ ] Connecteur Zotero
- [ ] Mode section/chapitre/livre complet dans l'UI
- [ ] Intégration Git

## Licence

MIT
