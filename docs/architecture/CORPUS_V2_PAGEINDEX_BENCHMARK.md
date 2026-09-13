# Corpus V2 — benchmark PageIndex

Status: **REJECT** for runtime integration in Corpus V2 as of 2026-09-13.

Issue: #221. Parent: #212.

## Decision

PageIndex is **not integrated** into the runtime at this stage.

This is not a judgement that PageIndex is intrinsically poor. The decision is narrower: Corpus V2 has no measured evidence that PageIndex improves the retrieval criteria that matter to AutoEssay enough to justify a new runtime dependency, model-backed indexing/retrieval cost, operational configuration, and an additional backend to maintain.

The existing seam from #215 remains the only extension point:

```text
CorpusExplorer
  -> CorpusLocator (backend suggestion only)
  -> canonical IngestedDocument
  -> rematerialized RetrievedPassage
```

No PageIndex type may cross `CorpusExplorer`, and a future backend may only suggest locations. Final text/provenance remains owned by `IngestedDocument`.

## What was actually evaluated

### Existing AutoEssay baseline

The local baseline from #215 was replayed on three real PDFs from the historical prototype corpus:

| Source | PDF pages |
|---|---:|
| Jean-Frédéric Schaub, *Pour une histoire politique de la race* | 183 |
| Jean-Frédéric Schaub & Silvia Sebastiani, *Race et histoire dans les sociétés occidentales* | 393 |
| Kevin Ingram & Juan Ignacio Pulido Serrano (dir.), *The Conversos and Moriscos in Late Medieval Spain and Beyond* | 270 |

830 pages yielded extractable text through the same class of PDF extraction used by #218.

The historical PageIndex prototype queries were replayed against the exact lexical algorithm of #215, with exploration and corroboration kept separate.

Observed local latency in the benchmark environment was approximately **215–258 ms per query** across the 830-page corpus.

Observed behavior:

- exploration source diversification works: top results are round-robin diversified across available sources when matches exist;
- canonical rematerialization remains deterministic and model-free;
- common query terms create false positives because the baseline is intentionally simple lexical retrieval;
- corroboration can concentrate several top results on the same source;
- the probe label (`support`, `contradiction`, `qualification`, etc.) is retained by the contract but does not itself give the lexical backend semantic understanding of that role.

Conclusion: the baseline is intentionally limited. This leaves room for a future advanced locator, but does not establish that PageIndex is the right one.

### PageIndex

The historical prototype used PageIndex local chat as a locator and then verified excerpts against PDF pages. It required explicit index and chat/retrieval models.

Current upstream PageIndex adds PageIndex Flash, which can build a **raw PDF tree without an LLM** (`summary=False`, `optimize=False`). However:

- the raw Flash tree is only an index structure, not the reasoning retrieval backend being considered here;
- PageIndex's reasoning retrieval remains model-backed;
- the public upstream quality benchmark is primarily factual lookup over long PDFs, whereas Corpus V2 needs exploration diversity, contradiction, qualification, counterexample, scale shifts and singularity;
- therefore upstream benchmark claims cannot substitute for a same-corpus AutoEssay comparison.

A raw Flash tree was not relabelled as “PageIndex retrieval” for this benchmark, because that would produce a misleading comparison.

## Why the verdict is REJECT, not LIMITED

`LIMITED` would still require a runtime adapter. Under Ponytail/YAGNI, an adapter is justified only after a measured gain.

At this stage:

1. the AutoEssay baseline is operational and deterministic;
2. its weaknesses are known;
3. PageIndex may plausibly improve some of them, but this has not been demonstrated on AutoEssay's discriminating probes;
4. agentic PageIndex retrieval introduces model calls and model-dependent latency/cost;
5. keeping a PageIndex dependency or adapter “for later” would create dead architecture without evidence.

The correct engineering decision is therefore **REJECT for the current Corpus V2 cutover**, while preserving the existing generic locator seam.

## Hard gates for any future re-evaluation

A future PageIndex proposal may be reopened only if all of the following are measured on the **same documents and same queries** as the baseline:

1. **Canonicality — hard gate:** 100% of accepted results must be rematerialized from the active `IngestedDocument`; an unverifiable PageIndex excerpt is rejected, never surfaced as a `RetrievedPassage`.
2. **Contract isolation — hard gate:** no PageIndex class/type/storage/client leaks through `CorpusExplorer`, Plan V2, Writer or domain objects.
3. **Exploration:** source diversity must be at least equal to the baseline, and blind mean score on relevance + non-redundance + intellectual interest must improve by **at least 0.5 point on a 0–3 scale**.
4. **Corroboration:** PageIndex must not score lower than baseline on contradiction or qualification, and each benchmark case must return at least one usable result for every probe that has supporting material in the corpus.
5. **Poor structure:** flat/poorly structured PDFs and degraded extraction must fail explicitly; no missing material may be interpreted as absence.
6. **Operational transparency:** query latency, number of model calls, token usage and estimated cost must be recorded. No hidden cloud dependency is acceptable for the local path.
7. **Maintenance:** if the gain passes these gates, integrate the smallest possible `CorpusLocator` adapter only; do not import PageIndex storage/chat semantics into AutoEssay.

## Existing executable contracts

The runtime guarantees required from any future PageIndex adapter are already tested in `tests/corpusExplorer.test.ts`:

- one `CorpusExplorer` port;
- exploration/corroboration contract separation;
- backend locations are rematerialized from canonical document text;
- unknown document/block locations are rejected;
- fingerprints and locators come from the canonical `IngestedDocument`.

No additional PageIndex-specific runtime test or dependency is kept after this decision because the verdict is REJECT.

## Artifacts intentionally not promoted

The historical branch `prototype/pageindex-corpus-explorer` remains disposable reference material only. Its PageIndex worker, scratch storage, manifest and interactive review harness are **not** merged into Corpus V2.

No `pageindex` Python dependency, JS SDK, PageIndex cloud client, storage layer, fork, or adapter is added by #221.

## Revisit trigger

Reopen this decision only when one of these becomes true:

- the lexical baseline demonstrably fails a production AutoEssay corpus in a way the generic locator seam cannot cheaply correct; or
- a funded/configured PageIndex benchmark can be run on the same Corpus V2 documents and discriminating probes with the hard gates above.

Until then, the supported backend remains the local baseline from #215.