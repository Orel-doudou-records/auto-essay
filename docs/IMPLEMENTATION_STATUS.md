# Literacraft integration — implementation status

## Phase 1: domain contracts ✅

Merged by PR #8 at commit `f5a36bf`.

- documentary source regimes, situated positions and epistemic limits
- relational `StyleObservation`
- explicit `ContentRelation` and shared `EditorialScope`
- `ContentStyleArticulation`
- versioned `EditorialDecision`
- situated `EditorialPlan`
- optional editorial references on `DraftUnit`

## Phase 2: analysis and planning ✅

Merged by PR #14 at commit `9848d46`.

- grounded `ObservationAnalyzer`
- deterministic and model-assisted `RelationAnalyzer`
- non-executable `ArticulationResolver`
- author-governed `EditorialDecisionService`
- section and paragraph editorial planning
- explicit inherited and local decisions

## Phase 3: writer integration ✅

Merged by PR #19 at commit `c4dd596`.

- writer, evaluator and revision projections compiled from one validated plan
- optional editorial context in historical paragraph mode
- projection guardrails for claims, evidence and source relations
- grounded transformation declarations and `TransformationTrace`
- sequential paragraph execution through `SectionGenerator`
- paragraph `DraftUnit` boundaries preserved
- assembled section represented as a `DraftUnit`
- no partial section returned after a paragraph generation failure

## Phase 4: evaluation and revision ✅

Implemented by PR #24.

- independent `EditorialEffectEvaluation` beside `EssayEvaluation`
- strict editorial-effect judging against canonical criteria and exact excerpts
- integrated documentary and editorial gates without score compensation
- evaluator context extended with independent projection and writer declarations
- relational revision instructions tied to criteria, decisions, articulations and directives
- explicit preservation of invariants, claims and prohibited shortcuts
- deterministic projection fingerprints
- editorial decision versions, projection ids/hashes and trace ids persisted in manifests
- registry publication rejects provenance inconsistent with the published `DraftUnit`
- historical evaluator, revision and manifest modes remain compatible

## Preserved invariants

- `DraftUnit` remains the unit of generation, evaluation, revision and versioning.
- `EvidencePack` remains required before generation.
- Existing paragraph mode does not require Literacraft data.
- Candidate articulations are not executable.
- Only author-validated decisions can enter an executable plan.
- Revoked or superseded decisions are not executable.
- Writer declarations are traces, not evaluations of success.
- Writer and evaluator remain separate.
- Editorial success cannot compensate documentary failure.
- Revision cannot silently alter claims, confidence levels or attribution.
- Prompts are projections and never the canonical source of a decision.
- The initial `styleProfile.ts`, `styleEngine.ts` and `prompts.ts` prototype remains isolated pending the Phase 5 migration audit.

## Verification

Each merged or active phase is validated by GitHub Actions with:

```bash
npm ci
npm run typecheck
npm test
```

Phase 4 passed all checks on PR #24 before review.

## Next phase

Phase 5 proves the complete path and resolves the initial prototype:

- build a reproducible synthetic fixture
- exercise a real editorial case
- audit and migrate, deprecate or remove the initial prototype
