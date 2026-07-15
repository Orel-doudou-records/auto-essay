# Literacraft integration — implementation status

## Phase 1: domain contracts

Implemented on `feat/literacraft-diffractive-style-engine`:

- `SourceRegime`, situated source position and epistemic limits
- `StyleObservation`
- `ContentRelation` and shared `EditorialScope`
- `ContentStyleArticulation`
- `EditorialDecision`
- `EditorialPlan`
- optional editorial references on `DraftUnit`
- public domain exports
- unit tests for the new contracts and backwards compatibility
- GitHub Actions CI for typecheck and tests

## Preserved invariants

- `DraftUnit` remains the unit of generation, evaluation, revision and versioning.
- Existing paragraph mode does not require Literacraft data.
- Candidate articulations are not executable.
- Only author-validated decisions can enter a plan.
- Revoked or superseded decisions are not executable.
- Prompts, writer and evaluator are unchanged in Phase 1.
- The initial `styleProfile.ts`, `styleEngine.ts` and `prompts.ts` prototype remains isolated pending the migration audit.

## Verification status

Phase 1 has been validated by GitHub Actions on draft PR #8.

The CI job completed successfully with:

```bash
npm ci
npm run typecheck
npm test
```

The pull request remains in draft for architectural review before merge.
