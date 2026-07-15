/**
 * @deprecated Phase 5 migration tombstone.
 *
 * Literacraft is no longer an autonomous style engine. Analysis, relation
 * resolution, author validation, planning, projection, evaluation and revision
 * are integrated into Auto Essay through the `editorial`, `pipeline`,
 * `evaluation` and `revision` modules.
 *
 * No runtime adapter is provided because converting a legacy profile directly
 * into generation instructions would bypass canonical decisions and author
 * validation.
 */
export const LEGACY_LITERACRAFT_STYLE_ENGINE_REMOVED = true as const;
