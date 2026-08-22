import { join, dirname } from "node:path";
import type { EssayState, EssayPhase, Debt } from "../domain/pipelineState";
import { createEssayState, transitionToPhase as transitionPhase, canReport, hasReachedIterationLimit } from "../domain/pipelineState";

/**
 * State Manager - Gère la persistance et les transitions d'état
 * Architecture sidecar local (inspirée d'OpenClaw)
 */
export interface StateManager {
  /** Charge l'état depuis le stockage */
  loadState(projectId: string): Promise<EssayState | null>;

  /** Sauvegarde l'état */
  saveState(state: EssayState): Promise<void>;

  /** Crée un nouvel état */
  createState(projectId: string): Promise<EssayState>;

  /** Met à jour l'état avec une fonction de modification */
  updateState(
    projectId: string,
    updater: (state: EssayState) => EssayState
  ): Promise<EssayState>;
}

/**
 * Implémentation fichier JSON (MVP)
 */
export class FileStateManager implements StateManager {
  private basePath: string;

  constructor(basePath: string = "./.auto-essay") {
    this.basePath = basePath;
  }

  private getStatePath(projectId: string): string {
    return join(this.basePath, projectId, "essay_state.json");
  }

  async loadState(projectId: string): Promise<EssayState | null> {
    try {
      const fs = await import("fs/promises");
      const path = this.getStatePath(projectId);
      const data = await fs.readFile(path, "utf-8");
      return JSON.parse(data) as EssayState;
    } catch {
      return null;
    }
  }

  async saveState(state: EssayState): Promise<void> {
    const fs = await import("fs/promises");
    const path = this.getStatePath(state.projectId);
    await fs.mkdir(dirname(path), { recursive: true });
    await fs.writeFile(path, JSON.stringify(state, null, 2));
  }

  async createState(projectId: string): Promise<EssayState> {
    const state = createEssayState(projectId);
    await this.saveState(state);
    return state;
  }

  async updateState(
    projectId: string,
    updater: (state: EssayState) => EssayState
  ): Promise<EssayState> {
    const current = await this.loadState(projectId);
    if (!current) {
      throw new Error(`State not found for project ${projectId}`);
    }
    const updated = updater(current);
    await this.saveState(updated);
    return updated;
  }
}

/**
 * Machine à états - Orchestration du pipeline
 * Garantit les transitions valides et l'invariant Execute → Verify → Report
 */
export class StateMachine {
  private stateManager: StateManager;

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
  }

  /**
   * Initialise un nouveau projet
   */
  async initialize(projectId: string): Promise<EssayState> {
    return this.stateManager.createState(projectId);
  }

  /**
   * Transition vers une nouvelle phase
   */
  async transitionToPhase(
    projectId: string,
    newPhase: EssayPhase
  ): Promise<EssayState> {
    return this.stateManager.updateState(projectId, (state) => {
      // Vérifier l'invariant : pas de reporting sans vérification
      if (newPhase === "export" && !canReport(state)) {
        throw new Error("Invariant violation: Cannot export without verification");
      }
      return transitionPhase(state, newPhase);
    });
  }

  /**
   * Incrémente l'itération courante
   */
  async incrementIteration(projectId: string): Promise<EssayState> {
    return this.stateManager.updateState(projectId, (state) => ({
      ...state,
      iteration: state.iteration + 1,
      metadata: {
        ...state.metadata,
        lastSavedAt: new Date().toISOString(),
      },
    }));
  }

  /**
   * Incrémente le cycle de révision
   */
  async incrementRevisionCycle(projectId: string): Promise<EssayState> {
    return this.stateManager.updateState(projectId, (state) => ({
      ...state,
      revisionCycle: state.revisionCycle + 1,
      metadata: {
        ...state.metadata,
        lastSavedAt: new Date().toISOString(),
      },
    }));
  }

  /**
   * Met à jour le score d'une unité
   */
  async updateUnitScore(
    projectId: string,
    unitId: string,
    score: number
  ): Promise<EssayState> {
    return this.stateManager.updateState(projectId, (state) => ({
      ...state,
      unitScores: {
        ...state.unitScores,
        [unitId]: score,
      },
      metadata: {
        ...state.metadata,
        lastSavedAt: new Date().toISOString(),
      },
    }));
  }

  /**
   * Met à jour le score global
   */
  async updateGlobalScore(projectId: string, score: number): Promise<EssayState> {
    return this.stateManager.updateState(projectId, (state) => ({
      ...state,
      globalScore: score,
      metadata: {
        ...state.metadata,
        lastSavedAt: new Date().toISOString(),
      },
    }));
  }

  /**
   * Ajoute une dette
   */
  async addDebt(projectId: string, debt: Debt): Promise<EssayState> {
    return this.stateManager.updateState(projectId, (state) => ({
      ...state,
      debts: [...state.debts, debt],
      metadata: {
        ...state.metadata,
        lastSavedAt: new Date().toISOString(),
      },
    }));
  }

  /**
   * Marque une dette comme résolue
   */
  async resolveDebt(projectId: string, debtId: string): Promise<EssayState> {
    return this.stateManager.updateState(projectId, (state) => ({
      ...state,
      debts: state.debts.map((d) =>
        d.id === debtId ? { ...d, resolvedAt: new Date().toISOString() } : d
      ),
      metadata: {
        ...state.metadata,
        lastSavedAt: new Date().toISOString(),
      },
    }));
  }

  /**
   * Marque comme vérifié (permet le reporting)
   */
  async markVerified(projectId: string): Promise<EssayState> {
    return this.stateManager.updateState(projectId, (state) => ({
      ...state,
      lastVerifiedAt: new Date().toISOString(),
      metadata: {
        ...state.metadata,
        lastSavedAt: new Date().toISOString(),
      },
    }));
  }

  /**
   * Met à jour le focus actuel
   */
  async updateFocus(projectId: string, focus: string): Promise<EssayState> {
    return this.stateManager.updateState(projectId, (state) => ({
      ...state,
      currentFocus: focus,
      metadata: {
        ...state.metadata,
        lastSavedAt: new Date().toISOString(),
      },
    }));
  }

  /**
   * Incrémente le compteur d'appels API
   */
  async incrementApiCalls(projectId: string, count: number = 1): Promise<EssayState> {
    return this.stateManager.updateState(projectId, (state) => ({
      ...state,
      metadata: {
        ...state.metadata,
        totalApiCalls: state.metadata.totalApiCalls + count,
        lastSavedAt: new Date().toISOString(),
      },
    }));
  }

  /**
   * Vérifie si on a atteint la limite d'itérations
   */
  async hasReachedLimit(projectId: string): Promise<boolean> {
    const state = await this.stateManager.loadState(projectId);
    if (!state) return false;
    return hasReachedIterationLimit(state, state.phase);
  }

  /**
   * Obtient l'état actuel
   */
  async getState(projectId: string): Promise<EssayState | null> {
    return this.stateManager.loadState(projectId);
  }
}

/**
 * Factory pour créer une state machine avec FileStateManager
 */
export function createStateMachine(basePath?: string): StateMachine {
  const stateManager = new FileStateManager(basePath);
  return new StateMachine(stateManager);
}
