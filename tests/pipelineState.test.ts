import { describe, it, expect } from "vitest";
import {
  createEssayState,
  transitionToPhase,
  canReport,
  hasReachedIterationLimit,
} from "../src/domain/pipelineState";

describe("Pipeline State", () => {
  it("should create initial state", () => {
    const state = createEssayState("proj-1");

    expect(state.projectId).toBe("proj-1");
    expect(state.phase).toBe("intake");
    expect(state.iteration).toBe(0);
    expect(state.globalScore).toBe(0);
    expect(state.revisionCycle).toBe(0);
    expect(state.debts).toEqual([]);
  });

  it("should transition to next phase", () => {
    const state = createEssayState("proj-1");
    const next = transitionToPhase(state, "sourcing");

    expect(next.phase).toBe("sourcing");
  });

  it("should prevent backward transitions", () => {
    const state = createEssayState("proj-1");
    state.phase = "drafting";

    expect(() => transitionToPhase(state, "intake")).toThrow();
  });

  it("should prevent export without verification", () => {
    const state = createEssayState("proj-1");
    state.phase = "reviewing";

    expect(canReport(state)).toBe(false);
    // Note: transitionToPhase itself doesn't check verification,
    // this is done in StateMachine.transitionToPhase
    expect(() => transitionToPhase(state, "export")).not.toThrow();
  });

  it("should allow export after verification", () => {
    const state = createEssayState("proj-1");
    state.phase = "reviewing";
    state.lastVerifiedAt = new Date().toISOString();

    expect(canReport(state)).toBe(true);
    const next = transitionToPhase(state, "export");
    expect(next.phase).toBe("export");
  });

  it("should detect iteration limits", () => {
    const state = createEssayState("proj-1");
    state.phase = "planning";
    state.iteration = 25;

    expect(hasReachedIterationLimit(state, "planning")).toBe(true);
  });
});
