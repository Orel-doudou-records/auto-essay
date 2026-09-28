# Reference workspace UI and journey audit

## Scope and authority

The five reference images supplied by the author define a light, blue-accented editorial workspace: a manuscript tree and library on the left, active content in the middle, and a contextual assistant on the right. The primary views are **Écrire, Plan, Sources, Analyse**. The image labelled “Dossier technique” is implementation guidance, not a fifth application screen. The supplied historical examples, quotes, percentages and counts are illustrative and must never be inserted as project data.

This change adapts ADR-007: StyleX, semantic light/dark tokens, serif manuscript, sans-serif controls, a simple Markdown text editor, and explicit application of proposals remain. Desktop columns are visible by default and can be collapsed independently; compact screens expose one panel at a time. Cadrage, import, export and the existing editorial workshop remain reachable.

## Journey and backend mapping

All endpoint paths below are relative to `/api/projects/:projectId`.

| View / area | Author journey | Canonical backend | Checks and limits |
|---|---|---|---|
| Global shell | Return to projects, move between the four views, open Cadrage or import from the menu | `GET /api/projects/:projectId`; existing routes | Carry `unitId`, `nodeId`, `chapterId` in URLs. No invented login/avatar, global search or project status. |
| Manuscript tree | Expand/collapse, select a node or written passage, add a section | `GET /editorial/manuscript-navigation`, `GET/POST /units` | Standalone units are visible before a plan exists. A node and a written unit remain distinct. Plan scope is the selected node or immediate parent of a unit. |
| Écrire | Edit, format Markdown, save, change selection, export | `PATCH /units/:unitId`, existing export route | Debounced writes are serialized. Internal navigation flushes pending text and stays put on failure. Unsaved local text can be explicitly restored after interruption. |
| Revision | Request, edit and compare a proposal, accept or reject | Existing revise-chat / collaborative revision APIs | Revision requests flush pending text before contacting the model; failed saves block requests. Reselecting the active passage preserves its saved content. Legacy apply awaits persistence. Collaborative apply saves current local text before backend conflict checking. Generation is offered only for empty text. Comparison is before/after text, not a token-level diff. |
| Plan | Select an existing node, review sections, explore sources, prepare a structure, review changes, apply | Existing chapter workspace and planning state, exploration, decomposition, structural-diff/apply APIs | No raw technical ID entry. Existing PlanV2 workflow is retained under a disclosure. Application refreshes navigation. Inspector scope follows the loaded chapter, not an unconfirmed dropdown choice. Manual create/rename/up/down controls preview one change before calling the same planning apply contract. Operation tracking stays a separate disclosure. |
| Sources | Import Markdown/BibTeX, search/filter, inspect content/passages, annotate, attach to a manuscript selection | Existing source import/read/patch/delete; new read-only `GET /sources/overview`; existing scope source selection PUT | Exploration states come from `SourceProfile.comprehension`. Import errors are displayed. Notes and limits save explicitly. Links come from actual draft evidence packs and active node planning briefs/distribution. Node links refresh after attachment. |
| Source assistant | Ask about a selected source even before a manuscript exists | `GET/POST /scope-conversation/source/:sourceId`; `GET /scope-context/source/:sourceId` | Journal isolated by source. Source text supplied to the model. A source cannot select itself as its manuscript context (409). |
| Analyse | Inspect hypotheses, gaps, included sources, recorded readings; go to evaluation or editorial decisions | Extended `GET /scope-context/:kind/:id`, existing evaluate/workshop APIs | Hypotheses retain declared status. Counts describe documents/passages, never an invented quality percentage. Chapter counts aggregate nested units, plan entries and descendant source contexts, retaining passage unit IDs. Direct node selection remains distinct from descendant evidence. All saved readings explicitly carry unverified freshness and are displayed as historical: manual content edits do not always increment unit versions. |
| Context panel | Switch Agent / Sources / Contexte / Décisions | Existing scope context and conversation APIs | Sources and decisions shown to the author are also supplied to conversation prompts. Chat does not execute edits or decisions. |
| Documents | Import manuscript or plan, compare a new manuscript file | Existing preview/confirm/reimport journeys | The API does not expose an uploaded-file inventory; navigation links replace illustrative DOCX/XLSX filenames. |

## Deliberate adaptations and remaining gaps

- Source uploads through this view support `.md` and `.bib`, matching its existing API. No fake PDF upload or XLSX parser is introduced. Manuscript imports retain their existing supported formats.
- The editor remains plain Markdown. Toolbar actions insert syntax; rich text, underline and in-place citation editing are not represented as functioning controls.
- Plan restructuring stays in the existing PlanV2 proposal flow. Manual creation, renaming and up/down ordering use the existing structural change schema; there is no drag-and-drop reorder UI.
- The source overview uses an actual abstract only when one exists. No generated summary, ISBN, collection, page quote or exploration progress is fabricated.
- Analysis does not infer numerical proof coverage. It shows saved hypotheses, gaps, evidence counts and recorded Diffract results. Existing evaluation and editorial decision workflows remain the routes for generating deeper judgments.
- Context discussions and text revision remain two explicit operations within the Agent tab. Chat alone cannot accept a revision or author an editorial decision.
- The document column cannot display original uploaded filenames because the current backend does not retain an inventory exposed to this UI.

## Verification

Targeted regression tests cover source exploration states, conversation context grounding, source journals without a manuscript, explicit annotations, source selection rejection, partial import errors, primary-view URL preservation, save-before-selection failure recovery, and explicit local draft recovery. Existing editor, plan, import, evaluation and collaborative revision suites also apply.

Validation on the completed change: 432 core tests, 143 API tests and 77 web tests passed (652 total), with typecheck, lint and the production build passing. Vitest reports a web runner shutdown timeout after all assertions pass; this is not a browser rendering check. Visual browser verification is currently blocked in this execution environment: the cloud browser rejects `localhost`, and the local Playwright browser download failed. Pixel fidelity, scrolling and narrow-screen rendering remain a manual review gate; automated responsive interaction tests do not replace that inspection.

## Review resolution

Standards review found stale reselection after saving, an inspector tied to an unconfirmed chapter choice, missing desktop panel controls, and unsupported reading freshness. These are corrected with save/selection regression coverage, loaded chapter scoping, independent panel toggles and explicit historical readings.

Specification review identified source links missing their node associations, chapter analysis missing descendant evidence, and revision requests racing autosave. API projections and UI consumers now cover those journeys; tests exercise source attach/detach, evidence provenance and save-before-revision failure handling. The reviewer returned these findings before its final run stopped; the implementation and checks were completed locally.
