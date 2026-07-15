/**
 * @deprecated Phase 5 migration tombstone.
 *
 * The former prompts compiled a global style profile into generation
 * directives. Prompt rendering now lives beside the structured service that
 * consumes it:
 *
 * - `ObservationAnalyzer` for grounded observations;
 * - `RelationAnalyzer` and `ArticulationResolver` for situated proposals;
 * - `ParagraphGenerator` for writer projections;
 * - editorial and documentary evaluators for independent judgments.
 *
 * No legacy profile-to-directive prompt remains because prompts are delivery
 * layers, never canonical editorial decisions.
 */
export const LEGACY_LITERACRAFT_PROMPTS_REMOVED = true as const;
