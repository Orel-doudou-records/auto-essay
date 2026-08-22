# Référence : Système d'évaluation

Ce document décrit le format des évaluations, les dimensions de scoring, les seuils de qualité et les verdicts.

## Format d'évaluation

```typescript
interface EssayEvaluation {
  overallScore: number;           // 0 à 10
  dimensions: {
    claimSupport: number;         // 0 à 10
    citationIntegrity: number;    // 0 à 10
    counterargumentQuality: number; // 0 à 10
    transitionClarity: number;    // 0 à 10
    scopeControl: number;         // 0 à 10
    voiceConsistency: number;     // 0 à 10
  };
  weaknesses: Weakness[];
  strongClaims: string[];
  weakClaims: string[];
  aiPatternsDetected: string[];
  overclaimRisks: OverclaimRisk[];
  top3Revisions: RevisionSuggestion[];
  newClaimEntries: NewClaimEntry[];
  evidenceGaps: EvidenceGap[];
  citationGaps: CitationGap[];
  verdict: "keep" | "keep_with_minor_edits" | "revise" | "discard";
  evaluatedAt: string;
  evaluatorModel: string;
}
```

## Dimensions de scoring

### `claimSupport` (Soutien des assertions)

Mesure si les preuves citées soutiennent effectivement les assertions du texte.

| Score | Interprétation |
|-------|----------------|
| 0-4 | Preuves insuffisantes ou hors sujet |
| 5-6 | Preuves partielles, lacunes notables |
| 7-8 | Preuves solides, quelques manques |
| 9-10 | Preuves exhaustives et parfaitement alignées |

### `citationIntegrity` (Intégrité des citations)

Évalue la précision, la présence et le format des citations.

| Score | Interprétation |
|-------|----------------|
| 0-4 | Citations absentes, mal formées ou inventées |
| 5-6 | Citations présentes mais incomplètes |
| 7-8 | Citations correctes, format respecté |
| 9-10 | Citations irréprochables, contextes précis |

### `counterargumentQuality` (Qualité des objections)

Mesure si les objections connues sont identifiées et traitées avec intellectual honnêteté.

| Score | Interprétation |
|-------|----------------|
| 0-4 | Aucune objection, ou straw men |
| 5-6 | Objections mentionnées mais mal traitées |
| 7-8 | Objections sérieusement engagées |
| 9-10 | Objections anticipées, nuancées, réfutées avec élégance |

### `transitionClarity` (Clarté des transitions)

Évalue la fluidité logique entre les phrases et les idées.

| Score | Interprétation |
|-------|----------------|
| 0-4 | Sauts logiques, lecteur perdu |
| 5-6 | Transitions présentes mais mécaniques |
| 7-8 | Enchaînements fluides |
| 9-10 | Progression dialectique maîtrisée |

### `scopeControl` (Contrôle de la portée)

Détecte les sur-généralisations et les extrapolations au-delà des preuves.

| Score | Interprétation |
|-------|----------------|
| 0-4 | Généralisations abusives, causalités non fondées |
| 5-6 | Quelques élargissements injustifiés |
| 7-8 | Portée bien délimitée |
| 9-10 | Nuance parfaite entre spécifique et général |

### `voiceConsistency` (Cohérence de la voix)

Vérifie que le ton, la personne et le registre sont maintenus.

| Score | Interprétation |
|-------|----------------|
| 0-4 | Changements de ton abrupts, registres mélangés |
| 5-6 | Voix globale identifiable, quelques glissements |
| 7-8 | Voix stable et cohérente |
| 9-10 | Voix distinctive et maintenue sur toute la longueur |

## Seuils de qualité

```typescript
const QUALITY_THRESHOLDS = {
  KEEP_THRESHOLD: 6.0,            // Garder l'unité
  PLANNING_THRESHOLD: 7.5,        // Valider la phase de planning
  MINOR_EDITS_THRESHOLD: 7.0,     // Garder avec éditions mineures
  IMPROVEMENT_DELTA: 0.3,         // Détection de plateau
};
```

| Seuil | Utilisation |
|-------|-------------|
| ≥ 6.0 | Unité acceptable pour publication |
| ≥ 7.0 | Unité bonne, corrections mineures suffisantes |
| ≥ 7.5 | Planning validé, passage à la rédaction autorisé |
| < 0.3 | Plateau détecté entre deux évaluations |

## Verdicts

| Verdict | Seuil typique | Action |
|---------|---------------|--------|
| `keep` | ≥ 8.0 | Aucune révision |
| `keep_with_minor_edits` | 7.0 - 7.9 | Ajustements superficiels |
| `revise` | 6.0 - 6.9 | Révision substantielle |
| `discard` | < 6.0 | Réécriture complète |

## Types de risques de sur-assertion (`OverclaimRisk`)

| Type | Description |
|------|-------------|
| `unsupported_generalization` | Généralisation sans preuve suffisante |
| `causal_overreach` | Causalité affirmée sans mécanisme démontré |
| `unverified_certainty` | Certitude absolue sans consensus |
| `missing_citation` | Fait présenté sans source |
| `extrapolation_beyond_evidence` | Extension au-delà de ce que les données autorisent |

## Faiblesses (`Weakness`)

```typescript
interface Weakness {
  dimension: EvaluationDimension;
  description: string;
  severity: "critical" | "major" | "minor";
  location?: string;
  suggestedFix?: string;
}
```

## Voir aussi

- [Référence : API](api.md)
- [Comment évaluer et réviser](../how-to/evaluer-reviser.md)
- [Explication : Système dual d'évaluation](../explanation/systeme-evaluation.md)
