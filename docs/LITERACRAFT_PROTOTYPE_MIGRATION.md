# Literacraft prototype migration

## Decision

The initial Literacraft prototype is retired as an execution path.

Its useful concepts are preserved inside Auto Essay's canonical domain and pipeline. No autonomous style engine, global profile-to-prompt compiler or direct style preset remains.

The historical files are retained as migration tombstones because repository deletion was unavailable during this migration:

- `src/domain/styleProfile.ts`
- `src/style/styleEngine.ts`
- `src/style/prompts.ts`

They export only explicit `LEGACY_*_REMOVED` constants and contain no runtime engine or compatibility schemas.

## Concept mapping

| Initial prototype | Integrated destination | Migration decision |
| --- | --- | --- |
| `StylePattern` | `StyleObservation` and `ObservedPracticeSummary` | Preserve grounded mechanisms and evidence; remove global pattern authority. |
| `StyleProfile` | `AuthorStyleConstellation` | Replace with a derived, non-executable longitudinal view. |
| `ContentPillar` | `EssayProject`, `ArgumentMap`, claims, concepts and content relations | Move content structure out of the style object. |
| `Entanglement` | `ContentRelation` plus `ContentStyleArticulation` | Represent the actual relation between project matter and writing operation. |
| `AgentialCut` | `EditorialDecision` commitments, invariants and prohibited shortcuts | Preserve explicit inclusion/exclusion choices under author governance. |
| `DiffractiveStylePlan` | `EditorialPlan` and specialized projections | Replace one style plan with a canonical plan and three delivery views. |
| `emergentVoice.generationDirectives` | writer projection directives | Compile only from active, author-validated decisions. |
| `evaluationCriteria` | evaluator projection criteria and `EditorialEffectEvaluation` | Judge effects independently from documentary evaluation. |
| `LiteracraftStyleEngine.analyze()` | `ObservationAnalyzer` | Produce localized content–form observations, not a global profile. |
| `LiteracraftStyleEngine.diffract()` | `RelationAnalyzer`, `ArticulationResolver`, `EditorialDecisionService` | Decompose relation analysis, proposal and author validation. |
| `buildGenerationStyleDirectives()` | `ProjectionCompiler` and `ParagraphGenerator` renderer | Keep structured data canonical; render text only at delivery time. |

## Preserved principles

### Observable mechanisms

A valid observation still needs:

- a content configuration;
- a formal operation;
- an observed effect;
- textual evidence or a location;
- explicit confidence and provenance.

This preserves the prototype's rejection of adjective-only style descriptions.

### Ethical boundary

`AuthorStyleConstellation` fixes two boundaries:

- preserve mechanisms rather than surface;
- forbid verbatim reuse of singular formulations.

Additional signatures, productive tensions and unwanted drifts are supplied as explicit declarations. They are not inferred automatically from one passage.

### Explicit cuts

What the prototype called an agential cut now appears in an `EditorialDecision` through:

- content commitments;
- formal commitments;
- invariants;
- prohibited shortcuts;
- version and status;
- explicit author validation.

This is more operational and auditable than a free-standing style plan.

## Removed assumptions

The integrated architecture rejects the following assumptions from the prototype path:

- one source text can establish a stable author profile;
- a profile can be applied directly to a new subject;
- content pillars belong inside a style model;
- a model-generated emergent voice can become executable without author validation;
- prompt text can be the durable record of an editorial decision;
- writer declarations can prove that an effect succeeded.

## Compatibility policy

No automatic converter from `StyleProfile` or `DiffractiveStylePlan` is provided.

An automatic converter would falsely legitimize legacy profile conclusions and bypass the new provenance requirements. Legacy data must be re-ingested as source text, analyzed into grounded observations and reviewed through the normal articulation and decision path.

## Resulting public architecture

```text
observed author text
        ↓
StyleObservation[]
        ↓ optional derived view
AuthorStyleConstellation

project sources + claims
        ↓
ContentRelation[]
        ↓ with observations
ContentStyleArticulation[]
        ↓ author validation
EditorialDecision[]
        ↓
EditorialPlan
        ↓
writer / evaluator / revision projections
```

`AuthorStyleConstellation` never connects directly to the writer. It can inform analysis and proposal selection, but an executable operation still requires a situated articulation and an active editorial decision.
