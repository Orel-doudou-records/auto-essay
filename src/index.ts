/**
 * @auto-essay/core
 * 
 * Agent orienté essai - Moteur de rédaction argumentative
 * 
 * Combine :
 * - OpenClaw : orchestration, state machine, registry déterministe
 * - autonovel : pipeline itératif, scoring, séparation juge/écrivain
 * - Litfract : philosophie de décision éditoriale
 * 
 * @example
 * ```typescript
 * import { 
 *   createEssayProject, 
 *   createDraftUnit, 
 *   createStateMachine,
 *   createParagraphGenerator 
 * } from "@auto-essay/core";
 * 
 * // Créer un projet
 * const project = createEssayProject({ title: "Mon essai" });
 * 
 * // Initialiser la state machine
 * const stateMachine = createStateMachine();
 * await stateMachine.initialize(project.id);
 * 
 * // Créer une unité de rédaction (paragraphe)
 * const unit = createDraftUnit({
 *   projectId: project.id,
 *   granularity: "paragraph",
 *   evidencePack: { sourceIds: [source1.id, source2.id] }
 * });
 * ```
 */

// Domaine
export * from "./domain/index.js";

// État
export * from "./state/index.js";

// Ingestion
export * from "./ingestion/index.js";

// Évaluation
export * from "./evaluation/index.js";

// Révision
export * from "./revision/index.js";

// Pipeline
export * from "./pipeline/index.js";
