# CC1-AE2 — Production authority cutover activation

## Status

Activated by #182. This note records the production boundary after the AE2 rollout defined in `cc1-ae2-production-authority.md`.

## Active authority boundary

`revise-chat` now selects exactly one authority path per request.

| Target at revision start | Authority | Persistence |
| --- | --- | --- |
| Mounted `DraftUnit` paragraph with exactly one #168 `LiteraryNode` identity | Collaborative Core | CC1 workspace / ChangeSet / Revision state only |
| Unmounted paragraph | Legacy | `revision-proposals.json` |
| Section, chapter or book unit | Legacy | `revision-proposals.json` |
| Ambiguous paragraph identity, including multiple PlanEntry identities for one leaf | Legacy | `revision-proposals.json` |

Standard and streaming `revise-chat` share the same source capture and candidate finalization rules. A request must never write both legacy proposal state and collaborative work state.

An ambiguity discovered while selecting authority is therefore treated as non-eligibility and stays legacy. By contrast, once a request has entered the collaborative path, later unsupported projection drift is reported as `unsupported_projection_drift`; it must not silently fall back to legacy because that would create a second authority after collaborative state already exists.

## Canonical materialization boundary

Candidate generation and collaborative workspace revisions do not mutate the canonical AutoEssay `DraftUnit`.

For migrated requests the only path to a new canonical AutoEssay version is:

```text
revise-chat candidate
  -> CC1 workspace
  -> Proposal
  -> Review
  -> conflict/stale assessment
  -> Integration
  -> applied materialization
  -> DraftUnit vN+1 + manuscript reference update
```

Repeated acceptance of an already applied Integration is idempotent and cannot create `vN+2`. Reject leaves canonical AutoEssay content unchanged while preserving collaborative history. Concurrent manual autosave remains an external canonical change; it is synchronized before integration and can make the collaborative work stale or conflicting.

## Downstream behavior

The existing automatic diffractive-reading trigger `text_changed` is scheduled only after materialization has returned `integrated`/applied. Scheduler failure is downstream failure: it is absorbed and must never roll back an Integration whose canonical materialization already succeeded.

## Web authority

Collaborative work is accepted or rejected through the revision-work backend endpoints. The editor does not directly call the normal `updateUnit` path to apply collaborative content. The old direct update path remains only for legacy `RevisionProposal` flows.

## Remaining legacy scope

AE2 does not migrate:

- manual editor autosave;
- Writer/Judge generation and evaluation;
- imports and reimports;
- section/chapter/book revision authority;
- structural authoring and chapter workspaces;
- ContentStyleArticulation or EditorialDecision workflows;
- stale auto-adaptation/rebase;
- CRDT/realtime collaboration;
- authentication or publication workflows.

Those flows continue to use their existing AutoEssay authority and persistence rules.

## Regression contract

The #182 regression suite verifies the production boundary for mounted paragraphs, unmounted paragraphs, unsupported granularities, ambiguous identities, standard and streaming completion, reject, concurrent autosave drift, one-version materialization, idempotent repeated accept, post-applied `text_changed`, and scheduler failure after Integration. Existing AE2 recovery, projection-drift, API and web tests remain part of the full CI gate.
