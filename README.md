# Auto Essay

Agent autonome de rédaction essayistique fondé sur une boucle critique de type *juge / écrivain*.

Le projet vise à transformer un corpus brut (PDF, Markdown, BibTeX, notes) en essai structuré, traçable et révisable, sans perdre la cohérence argumentative entre chaque niveau de granularité.

## Principes

- **Séparation juge / écrivain** : un modèle de rédaction produit le texte, un modèle d'évaluation indépendant le juge.
- **Claim ledger** : chaque assertion publiée est reliée à des sources et à des traces de transformation.
- **Execute → Verify → Report** : aucun livrable n'est exporté sans vérification préalable.
- **Sorties structurées** : Zod valide tous les échanges entre modules.
- **Échelle modulaire** : paragraph → section → chapter → book, avec le même noyau métier.

## Démarrage rapide

```bash
# Installation des dépendances
npm install

# Vérification statique
npm run typecheck

# Exécution des tests
npm test

# Lancer la démonstration du pipeline complet
npx tsx src/cli/runFullPipelineDemo.ts
```

## Scripts disponibles

| Commande | Description |
| --- | --- |
| `npm run typecheck` | Vérification TypeScript (`tsc --noEmit`) |
| `npm test` | Suite de tests avec Vitest |
| `npm run lint` | Lint ESLint (voir vague 4) |

## Architecture

```
src/
├── domain/        # Types métier, schémas Zod et règles pures
├── editorial/     # Planification, décisions, projections juge/écrivain
├── evaluation/    # Évaluateur read-only et vérifications mécaniques
├── ingestion/     # Import Markdown, BibTeX
├── pipeline/      # Modes paragraph et section
├── revision/      # Génération de briefs relationnels
├── state/         # Registry déterministe et machine à états
└── demo/          # Démonstrateurs et scénarios
```

## Documentation

- [`docs/PIPELINE.md`](./docs/PIPELINE.md) : phases du pipeline et anti-patterns.
- [`docs/adr/`](./docs/adr/) : décisions architecturales clés.

## Licence

MIT — voir `LICENSE`.
