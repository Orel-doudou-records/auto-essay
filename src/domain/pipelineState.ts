import { z } from "zod";

/**
 * Phases du pipeline essayistique
 */
export const EssayPhaseSchema = z.enum([
  "intake",      // Cadrage initial
  "sourcing",    // Import et organisation des sources
  "planning",    // Construction de l'argument map
  "drafting",    // Rédaction des unités
  "reviewing",   // Révision et évaluation
  "export",      // Export des livrables
]);

export type EssayPhase = z.infer<typeof EssayPhaseSchema>;

/**
 * Dette narrative/documentaire
 */
export const DebtSchema = z.object({
  id: z.string(),
  type: z.enum(["evidence", "citation", "transition", "counterargument", "clarification"]),
  description: z.string(),
  sourceUnitId: z.string().optional(),
  priority: z.enum(["high", "medium", "low"]),
  createdAt: z.string().datetime(),
  resolvedAt: z.string().datetime().optional(),
});

export type Debt = z.infer<typeof DebtSchema>;

/**
 * État global du pipeline - Inspiré d'OpenClaw
 * Invariant : Execute → Verify → Report
 */
export const EssayStateSchema = z.object({
  /** Phase actuelle */
  phase: EssayPhaseSchema.default("intake"),

  /** Focus actuel (description) */
  currentFocus: z.string().default(""),

  /** Itération courante */
  iteration: z.number().int().nonnegative().default(0),

  /** Scores par unité de rédaction */
  unitScores: z.record(z.number().min(0).max(10)).default({}),

  /** Score global du projet */
  globalScore: z.number().min(0).max(10).default(0),

  /** Cycle de révision actuel */
  revisionCycle: z.number().int().nonnegative().default(0),

  /** Dettes documentaires/narratives */
  debts: z.array(DebtSchema).default([]),

  /** Dernière vérification */
  lastVerifiedAt: z.string().datetime().optional(),

  /** ID du projet */
  projectId: z.string(),

  /** Métadonnées */
  metadata: z.object({
    startedAt: z.string().datetime(),
    lastSavedAt: z.string().datetime(),
    totalApiCalls: z.number().int().nonnegative().default(0),
    totalTokensUsed: z.number().int().nonnegative().default(0),
  }),
});

export type EssayState = z.infer<typeof EssayStateSchema>;

/**
 * Crée un nouvel état de pipeline
 */
export function createEssayState(projectId: string): EssayState {
  const now = new Date().toISOString();
  return EssayStateSchema.parse({
    phase: "intake",
    currentFocus: "",
    iteration: 0,
    unitScores: {},
    globalScore: 0,
    revisionCycle: 0,
    debts: [],
    projectId,
    metadata: {
      startedAt: now,
      lastSavedAt: now,
      totalApiCalls: 0,
      totalTokensUsed: 0,
    },
  });
}

/**
 * Vérifie l'invariant : Execute → Verify → Report
 * Ne pas reporter sans vérification préalable
 */
export function canReport(state: EssayState): boolean {
  return state.lastVerifiedAt !== undefined;
}

/**
 * Transition vers une nouvelle phase
 */
export function transitionToPhase(
  state: EssayState,
  newPhase: EssayPhase
): EssayState {
  const phases: EssayPhase[] = ["intake", "sourcing", "planning", "drafting", "reviewing", "export"];
  const currentIndex = phases.indexOf(state.phase);
  const newIndex = phases.indexOf(newPhase);

  // Ne permettre que les transitions en avant ou vers la même phase
  if (newIndex < currentIndex) {
    throw new Error(`Cannot transition from ${state.phase} to ${newPhase}`);
  }

  return {
    ...state,
    phase: newPhase,
    metadata: {
      ...state.metadata,
      lastSavedAt: new Date().toISOString(),
    },
  };
}

/**
 * Limite d'itérations par phase (inspiré d'autonovel)
 */
export const PHASE_LIMITS = {
  MAX_PLANNING_ITERS: 20,
  MAX_UNIT_ATTEMPTS: 5,
  MIN_REVISION_CYCLES: 3,
  MAX_REVISION_CYCLES: 6,
};

/**
 * Vérifie si on a atteint la limite d'itérations
 */
export function hasReachedIterationLimit(
  state: EssayState,
  phase: EssayPhase
): boolean {
  switch (phase) {
    case "planning":
      return state.iteration >= PHASE_LIMITS.MAX_PLANNING_ITERS;
    case "drafting":
      return state.iteration >= PHASE_LIMITS.MAX_UNIT_ATTEMPTS;
    case "reviewing":
      return state.revisionCycle >= PHASE_LIMITS.MAX_REVISION_CYCLES;
    default:
      return false;
  }
}
