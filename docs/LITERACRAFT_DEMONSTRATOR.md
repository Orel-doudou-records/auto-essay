# Literacraft integrated demonstrators

This document describes the reproducible demonstrations for the Literacraft integration inside Auto Essay.

The demonstrations do not use network access or a real model provider. Every structured model response is supplied by an explicit deterministic route and is still parsed and validated by the production schemas.

## Commands

```bash
npm ci
npm test
npm run demo:synthetic
npm run demo:station-reverse
```

The commands build the TypeScript project, execute one complete scenario and publish its final section into a local demonstration registry.

Default registry paths:

```text
.auto-essay-demo/synthetic
.auto-essay-demo/station-reverse
```

Set `AUTO_ESSAY_DEMO_PATH` to use another directory.

## Demonstrated path

Both scenarios exercise the same integrated path:

```text
Source + Claim
      ↓
StyleObservation
      ↓
ContentRelation
      ↓
ContentStyleArticulation (candidate)
      ↓ explicit author validation
EditorialDecision
      ↓
SectionEditorialPlan + paragraph plans
      ↓
writer / evaluator / revision projections
      ↓
paragraph DraftUnits → section DraftUnit
      ↓
TransformationTrace declarations
      ↓
EssayEvaluation + EditorialEffectEvaluation
      ↓ independent documentary/editorial gates
RevisionBrief
      ↓
DeliveryManifest + FileRegistry
```

The demonstration explicitly checks that the candidate articulation is not executable before author validation.

## Object roles

### Canonical objects

Canonical objects store the durable editorial state:

- `Source`
- `Claim`
- `StyleObservation`
- `ContentRelation`
- `ContentStyleArticulation`
- `EditorialDecision`
- `EditorialPlan`
- `DraftUnit`

A prompt is never the only copy of a canonical decision.

### Projections

`WriterEditorialProjection`, `EvaluatorEditorialProjection` and `RevisionEditorialProjection` are specialized views compiled from the same validated plan.

They are replaceable delivery objects, not new sources of truth.

### Traces

A `TransformationTrace` records where the writer declares that it attempted an operation. It does not prove that the operation succeeded.

### Evaluations

`EssayEvaluation` judges documentary and argumentative quality.

`EditorialEffectEvaluation` judges whether validated content–form operations produced their intended effects.

The integrated verdict applies two independent gates. Editorial success cannot compensate weak claims, citations or scope control.

## Synthetic scenario

Command:

```bash
npm run demo:synthetic
```

The scenario presents two incompatible dates for the opening of one place:

- a municipal record gives an administrative date;
- a testimony gives a later public-use date.

The planned operation keeps the claims separate, attributes each date to its source regime and treats the disagreement as the object of analysis instead of inventing a compromise date.

The scripted editorial evaluation marks the operation as partially effective, which produces a relational revision instruction while preserving the claims and their confidence levels.

## Station Reverse scenario

Command:

```bash
npm run demo:station-reverse
```

The real editorial case uses curated excerpts from two project documents:

- `# Charte maître — Nexus Diaspora.txt`;
- `# SPR — Nexus Diaspora Erykah Badu.txt`.

The charte establishes the ordering rule that textual beauty comes after accuracy and that an image must clarify rather than replace reasoning.

The SPR supplies a situated critical movement from concrete form to infrastructure and then to collective consequence.

The scenario does not build a global Nexus Diaspora style profile. It creates one grounded observation, one content relation and one author-validated articulation for this specific section.

### Documentary boundary

These documents are editorial and critical materials. They do not establish biographical dates, artistic intentions or historical facts about Erykah Badu by themselves.

The generated demonstration section states that limitation explicitly. A production article would still require primary, archival, journalistic or academic sources appropriate to its factual claims.

## Deterministic client

`ScriptedStructuredClient` associates every response with an explicit prompt marker. It fails when:

- no route matches a prompt;
- an expected route is never consumed;
- a production schema rejects the response;
- a response invents identifiers or textual evidence.

This structure tests the orchestration and invariants without pretending to measure the quality of a particular model provider.

## MVP limits

The demonstrations prove the integrated paragraph and section path. They do not implement:

- chapter or book orchestration;
- a graphical author-validation interface;
- collaborative multi-author conflict resolution;
- multiple specialized judges or dynamic judge routing;
- automatic learning of author rules;
- a graph database;
- a factual research agent or automatic source acquisition;
- production model adapters and retry policies;
- benchmark claims about literary quality.

The Station Reverse case proves architectural suitability and provenance. It is not a finished publishable article or a factual evaluation of Erykah Badu.
