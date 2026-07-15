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

Merged by PR #24 at commit `52d8b4e`.

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

## Phase 5: demonstrators and prototype migration ✅

Implemented by PR #29.

- deterministic full-pipeline demonstrator with no network or provider dependency
- synthetic contradictory-archive scenario
- Station Reverse scenario based on curated Nexus Diaspora charter and Erykah Badu SPR excerpts
- explicit author-validation barrier demonstrated before execution
- paragraph and section generation, integrated evaluation, relational revision and registry publication exercised end to end
- executable `demo:synthetic` and `demo:station-reverse` commands
- derived, non-executable `AuthorStyleConstellation`
- initial profile-first domain, autonomous engine and prompt compiler retired as migration tombstones
- prototype concepts mapped to canonical integrated objects
- architecture, provenance roles, source limits and MVP boundaries documented

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
- `AuthorStyleConstellation` is a derived consultation view and never connects directly to the writer.
- Real editorial materials retain explicit epistemic limits and do not become factual authority outside their scope.

## Verification

GitHub Actions validates the integrated MVP with:

```bash
npm ci
npm run typecheck
npm test
npm run demo:synthetic
npm run demo:station-reverse
```

All five steps passed on PR #29. The two demonstration commands compile an isolated CommonJS runtime, execute the complete path and publish into ignored local registries.

## MVP status

The integrated MVP now covers:

```text
sources and claims
→ grounded observations and content relations
→ situated articulation proposals
→ explicit author decisions
→ section and paragraph planning
→ specialized projections
→ paragraph and section generation
→ transformation traces
→ independent documentary and editorial evaluation
→ relational revision briefs
→ reproducible delivery manifests and registry versions
```

Deferred work remains documented in `docs/LITERACRAFT_DEMONSTRATOR.md`. It includes chapter/book orchestration, graphical author validation, multi-author conflict resolution, production provider adapters, specialized judge routing, automatic rule learning and a graph database.
