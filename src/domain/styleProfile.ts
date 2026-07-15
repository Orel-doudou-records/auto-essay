/**
 * @deprecated Phase 5 migration tombstone.
 *
 * The former `StyleProfile` and `DiffractiveStylePlan` schemas treated a
 * profile as the primary reusable object. The integrated architecture now uses:
 *
 * - `StyleObservation` for grounded content-form observations;
 * - `AuthorStyleConstellation` for a derived, non-executable longitudinal view;
 * - `ContentStyleArticulation` for situated proposals;
 * - `EditorialDecision` and `EditorialPlan` for author-validated commitments.
 *
 * This module intentionally exposes no compatibility schema. Callers must
 * migrate to the canonical domain objects instead of parsing legacy profiles.
 */
export const LEGACY_STYLE_PROFILE_REMOVED = true as const;
