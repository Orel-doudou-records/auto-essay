# WE1 — Writing Engine Litcraft compatibility

## Status

Ready for ticketing after Ponytail review.

## Problem Statement

AutoEssay already contains a production Literacraft implementation with essay-specific schemas, analyzers, articulations, author governance, writer traces and editorial evaluation. Writing Engine now contains a smaller domain-neutral Litcraft foundation that is intended to be shared with AutoFiction.

The migration must prove that AutoEssay can consume those shared semantics without weakening its richer essay-domain validation, changing its current execution path, or silently reinterpreting persisted data.

The first migration slice is therefore compatibility-only. AutoEssay remains authoritative while a thin adapter projects existing AutoEssay artifacts into Writing Engine contracts and parity tests compare the two representations.

## Solution

Pin Writing Engine as an exact Git dependency at:

`bc0613e649c9bff6db52114c3b5db6d48d2a177a`

Add one pure compatibility module owned by AutoEssay. It maps existing AutoEssay Literacraft artifacts into Writing Engine Litcraft artifacts. It does not replace AutoEssay schemas or services in this phase.

Target shape:

```text
AutoEssay canonical artifact
        ↓
pure compatibility adapter
        ↓
Writing Engine Litcraft artifact
        ↓
parity assertion / downstream shared use
```

No Writing Engine object becomes canonical AutoEssay state during this spec.

## User Stories

- As the AutoEssay maintainer, I can install a reproducible Writing Engine revision without publishing a package registry release.
- As an author, existing Literacraft behavior and governance remain unchanged during the migration.
- As a developer, I can project an AutoEssay `StyleObservation` into the shared `StyleObservation` without losing its identity, evidence, mechanism, effects, confidence, maturity or provenance.
- As a developer, I can prove the shared `AuthorStyleConstellation` derivation is semantically equivalent to AutoEssay's current derivation for representative observations.
- As a developer, I can project an AutoEssay transformation declaration into a shared `TransformationTrace` without treating the declaration as proof of success.
- As a developer, I can project an AutoEssay editorial criterion result into `EvaluatedStyleEffect` and then into the existing shared Diffract `ContextBlock` without moving AutoEssay's scores or gates.
- As a maintainer, I can remove no historical implementation until parity has been demonstrated and a later ticket explicitly switches a caller.

## Implementation Decisions

### 1. Exact Git dependency

AutoEssay depends on Writing Engine at the exact commit above. Do not depend on `main`, a branch name or a floating semver range.

The dependency is a migration bridge. No registry publication or release workflow is introduced here.

### 2. One compatibility module

Use one module, for example:

`src/editorial/writingEngineLitcraftAdapter.ts`

Do not create adapter classes, factories, registries, provider abstractions or a second Litcraft service layer.

### 3. StyleObservation mapping

Map AutoEssay `StyleObservation` to Writing Engine `StyleObservation` while preserving:

- `id`, `authorId`, `sourceTextId`, `confidence`, `maturity`, `createdAt`;
- evidence excerpt/location;
- provenance origin/notes;
- every formal operation with the same family, category, trigger, operation, target, observed effect and intensity.

Map AutoEssay's `contentConfiguration` to ordered Writing Engine `StyleSignal[]`:

```text
argumentativeFunction -> argumentative_function
claimTypes            -> claim_type
sourceRegimes         -> source_regime
relations             -> relation
tensions              -> tension
concepts              -> concept
```

Emit one signal for each source value. AutoEssay already guarantees at least one content configuration value, so the adapter must not invent a fallback signal.

Map AutoEssay observed-effect arrays to Writing Engine `StyleEffect[]`:

```text
argumentative -> { kind: "argumentative", statement }
epistemic      -> { kind: "epistemic", statement }
emotional      -> { kind: "emotional", statement }
reception      -> { kind: "reception", statement }
```

Do not collapse effect kinds into free text.

### 4. Constellation parity

The adapter may expose a small helper that maps observations/declarations and calls Writing Engine's `deriveAuthorStyleConstellation`.

Parity is semantic, not timestamp identity. Tests compare:

- author filtering;
- grouped family/category;
- observation ids;
- deduplicated operations/triggers/effects;
- weakest confidence;
- declarations;
- validated signatures;
- productive tensions;
- unwanted drifts;
- ethical boundary.

`derivedAt` is excluded from equality because both implementations generate it independently.

AutoEssay's existing `deriveAuthorStyleConstellation` remains the production implementation in this spec.

### 5. TransformationTrace mapping

Map AutoEssay's trace to the shared trace without deleting essay provenance:

```text
unitId         -> unitRef { kind: "draft-unit", id: unitId }
directiveId    -> operationRef { kind: "editorial-directive", id: directiveId }
projectionId   -> provenanceRef { kind: "writer-projection", id }
planId         -> provenanceRef { kind: "editorial-plan", id }
decisionId     -> provenanceRef { kind: "editorial-decision", id }
articulationId -> provenanceRef { kind: "content-style-articulation", id }
```

Preserve `id`, `unitVersion`, declaration, location/evidence, status and creation time.

The shared trace remains a declaration only.

### 6. Editorial effect mapping

Map one AutoEssay `EditorialCriterionResult` plus evaluation context to one shared `EvaluatedStyleEffect`.

Preserve:

- criterion/result identity through a stable shared id;
- unit/version scope reference;
- directive/trace provenance references where available;
- the exact status;
- textual evidence;
- unintended effects;
- repair suggestion;
- evaluator provenance and evaluation timestamp.

Represent findings as shared effects without moving product scores:

```text
contentFindings -> observed effect kind "content"
formFindings    -> observed effect kind "form"
unintendedEffects -> unintended effect kind "unintended"
```

Expected/intended effects may be supplied from the evaluator projection criterion when the caller has them. The adapter must not infer missing intent from scores.

`contentScore`, `formScore`, `contentFormCoherence`, `overallEditorialScore`, documentary integrity and final essay verdict stay AutoEssay-only.

### 7. Diffract feedback remains explicit

After an editorial result is projected to `EvaluatedStyleEffect`, callers may use Writing Engine's existing `evaluatedStyleEffectToContextBlock`.

The adapter does not invoke Diffract, schedule a reading or mutate any state.

### 8. No execution-path switch yet

Do not change:

- `ObservationAnalyzer` output type;
- `ArticulationResolver` inputs;
- `EditorialDecisionService`;
- `ProjectionCompiler`;
- writer projection/runtime;
- `EditorialEffectEvaluator` output type;
- integrated evaluation gates;
- persistence formats;
- demos' canonical behavior.

A later spec/ticket may switch individual callers only after this compatibility layer is green.

## Testing Decisions

### Slice A — dependency + observation parity

Tests must prove:

- Writing Engine imports from the pinned dependency;
- every AutoEssay content configuration field maps to the expected ordered signals;
- formal operation fields are unchanged;
- effect kinds are preserved;
- evidence/provenance/id/confidence/maturity/timestamp are preserved;
- no fallback signal is invented.

### Slice B — constellation parity

Use representative observations from one author plus a foreign author, multiple confidence levels, duplicate effects, declarations and explicit signatures/tensions/drifts.

Compare AutoEssay's current derivation with the shared derivation after adapter mapping, excluding `derivedAt` only.

### Slice C — trace/effect feedback parity

Tests must prove:

- trace provenance survives as typed generic references;
- a trace remains `declared` and contains no effectiveness score;
- criterion result status/evidence/repair/unintended findings map correctly;
- AutoEssay scores/gates are absent from the shared result;
- the shared effect becomes a `style-effect` Diffract `ContextBlock`;
- no writer declaration is mistaken for observed evaluation evidence.

### Existing regression suite

Every implementation PR must keep AutoEssay's existing CI green, including:

- lint;
- typecheck;
- core/API/web tests;
- build;
- synthetic Literacraft demo;
- Station Reverse demo.

## Out of Scope

- deleting or tombstoning current integrated Literacraft code;
- changing persisted data;
- changing model prompts;
- replacing `ObservationAnalyzer` or `EditorialEffectEvaluator`;
- moving `ContentStyleArticulation`, editorial decisions or projections;
- changing author governance;
- extracting more Writing Engine primitives;
- adding a package registry or release pipeline;
- automatically invoking Diffract after evaluation;
- changing AutoFiction.

## Further Notes

The migration succeeds by proving a seam, not by maximizing shared code in one pass. The compatibility module is allowed to be temporary; it should remain obvious enough to delete when AutoEssay eventually imports shared contracts directly.

## Ponytail challenge

The minimal migration is one exact dependency plus one pure adapter module and parity tests. Do not rewrite existing services, create dual-write persistence, add feature flags, introduce a plugin architecture, or delete the current implementation in the same phase.