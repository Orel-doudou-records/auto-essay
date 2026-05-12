# Référence : State machine

Ce document décrit le modèle d'état, les phases, les transitions et les invariants du pipeline essayistique.

## Phases du pipeline

Le pipeline est divisé en six phases séquentielles.

```
intake → sourcing → planning → drafting → reviewing → export
```

| Phase | Identifiant | Rôle |
|-------|-------------|------|
| **Intake** | `"intake"` | Cadrage initial, définition de la question centrale |
| **Sourcing** | `"sourcing"` | Import et organisation des sources |
| **Planning** | `"planning"` | Construction de la carte argumentative |
| **Drafting** | `"drafting"` | Rédaction des unités de contenu |
| **Reviewing** | `"reviewing"` | Évaluation et révision cyclique |
| **Export** | `"export"` | Compilation et livraison |

## Règles de transition

- **Unidirectionnelles** : il est interdit de revenir à une phase précédente.
- **Invariant `Exécuter → Vérifier → Rendre`** : la transition vers `"export"` est rejetée si `lastVerifiedAt` n'est pas défini.

```typescript
import { transitionToPhase } from "@auto-essay/core";

// Valide
const state1 = transitionToPhase(state, "sourcing");
const state2 = transitionToPhase(state1, "planning");

// Lève une erreur
const state3 = transitionToPhase(state2, "intake"); // Error: Cannot transition from planning to intake
```

## Structure de l'état

```typescript
interface EssayState {
  phase: EssayPhase;               // Phase courante
  currentFocus: string;            // Description du focus actuel
  iteration: number;               // Itération courante (génération)
  unitScores: Record<string, number>; // Scores par unité
  globalScore: number;             // Score global du projet
  revisionCycle: number;           // Cycle de révision (0 à 6)
  debts: Debt[];                   // Dettes documentaires/narratives
  lastVerifiedAt?: string;         // ISO 8601 — prérequis pour l'export
  projectId: string;               // ID du projet associé
  metadata: {
    startedAt: string;             // Date de début
    lastSavedAt: string;           // Date de dernière sauvegarde
    totalApiCalls: number;         // Compteur d'appels API
    totalTokensUsed: number;       // Compteur de tokens
  };
}
```

## Dettes documentaires

Une `Debt` représente un manque à combler avant que le projet ne soit considéré comme complet.

```typescript
interface Debt {
  id: string;
  type: "evidence" | "citation" | "transition" | "counterargument" | "clarification";
  description: string;
  sourceUnitId?: string;
  priority: "high" | "medium" | "low";
  createdAt: string;
  resolvedAt?: string;
}
```

## Limites d'itération

Le moteur impose des plafonds pour éviter les boucles infinies.

| Phase | Limite | Constante |
|-------|--------|-----------|
| Planning | 20 itérations | `MAX_PLANNING_ITERS` |
| Drafting (par unité) | 5 tentatives | `MAX_UNIT_ATTEMPTS` |
| Révision (min) | 3 cycles | `MIN_REVISION_CYCLES` |
| Révision (max) | 6 cycles | `MAX_REVISION_CYCLES` |

```typescript
import { hasReachedIterationLimit } from "@auto-essay/core";

const limitReached = hasReachedIterationLimit(state, "drafting");
```

## Vérification préalable à l'export

```typescript
import { canReport } from "@auto-essay/core";

if (canReport(state)) {
  // Autorisé à exporter
}
```

La fonction `canReport` retourne `true` uniquement si `lastVerifiedAt` est défini. C'est le mécanisme qui implémente l'invariant `Exécuter → Vérifier → Rendre`.

## Persistance

Par défaut, `FileStateManager` écrit dans `./.auto-essay/{projectId}/essay_state.json`.

```
.auto-essay/
└── {projectId}/
    ├── essay_state.json
    ├── registry.json
    └── units/
        ├── {unitId}_v1.json
        ├── {unitId}_v2.json
        └── ...
```

## Voir aussi

- [Référence : API](api.md)
- [Comment exporter un livrable](../how-to/exporter-livrable.md)
- [Explication : Architecture du moteur](../explanation/architecture.md)
