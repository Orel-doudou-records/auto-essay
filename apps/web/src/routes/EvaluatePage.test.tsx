import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDraftUnit } from "@auto-essay/core";
import {
  fetchEvaluationJudgeAssignments,
  fetchIntegratedEvaluationHistory,
  fetchIntegratedEvaluationReadiness,
} from "@/api";
import { useUnits } from "@/hooks/useUnits";
import { EvaluatePage } from "./EvaluatePage";

vi.mock("@/api", () => ({
  evaluateIntegratedUnit: vi.fn(),
  fetchEvaluationJudgeAssignments: vi.fn(),
  fetchIntegratedEvaluationHistory: vi.fn(),
  fetchIntegratedEvaluationReadiness: vi.fn(),
}));
vi.mock("@/hooks/useUnits", () => ({ useUnits: vi.fn() }));

const fetchAssignments = vi.mocked(fetchEvaluationJudgeAssignments);
const fetchHistory = vi.mocked(fetchIntegratedEvaluationHistory);
const fetchReadiness = vi.mocked(fetchIntegratedEvaluationReadiness);
const mockUseUnits = vi.mocked(useUnits);

const assignments = {
  documentary: {
    workType: "documentary_evaluation" as const,
    judge: {
      id: "judge-documentary",
      role: "judge" as const,
      model: "documentary-judge-model",
      specialty: "documentary_evaluation" as const,
    },
    rationale: "specialty_matches_work_type" as const,
  },
  editorial: {
    workType: "editorial_effect_evaluation" as const,
    judge: {
      id: "judge-editorial",
      role: "judge" as const,
      model: "editorial-judge-model",
      specialty: "editorial_effect_evaluation" as const,
    },
    rationale: "specialty_matches_work_type" as const,
  },
};

type UnitsHook = ReturnType<typeof useUnits>;

const unit = {
  ...createDraftUnit({
    projectId: "project-1",
    granularity: "paragraph",
    thesis: "Une unité évaluée",
    content: "Texte prêt à être évalué.",
  }),
  id: "unit-1",
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/projects/project-1/evaluate/unit-1"]}>
      <Routes>
        <Route path="/projects/:projectId/evaluate/:unitId" element={<EvaluatePage />} />
      </Routes>
    </MemoryRouter>
  );
}

function mockUnits(
  overrides: Partial<
    Pick<UnitsHook, "evaluate" | "evaluateIntegrated" | "generate" | "reviseChat">
  > = {}
) {
  mockUseUnits.mockReturnValue({
    units: [unit],
    loading: false,
    error: null,
    reload: vi.fn(),
    add: vi.fn(),
    update: vi.fn(),
    generate:
      overrides.generate ??
      vi.fn<Parameters<UnitsHook["generate"]>, ReturnType<UnitsHook["generate"]>>(),
    reviseChat: overrides.reviseChat ?? vi.fn(),
    evaluate:
      overrides.evaluate ??
      vi.fn<Parameters<UnitsHook["evaluate"]>, ReturnType<UnitsHook["evaluate"]>>(),
    evaluateIntegrated:
      overrides.evaluateIntegrated ??
      vi.fn<
        Parameters<UnitsHook["evaluateIntegrated"]>,
        ReturnType<UnitsHook["evaluateIntegrated"]>
      >(),
    verify: vi.fn(),
  });
}

describe("EvaluatePage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockUnits();
    fetchAssignments.mockResolvedValue(assignments);
    fetchHistory.mockResolvedValue([]);
  });

  it("keeps documentary evaluation explicit while explaining why integrated evaluation is unavailable", async () => {
    const generate = vi.fn<
      Parameters<UnitsHook["generate"]>,
      ReturnType<UnitsHook["generate"]>
    >();
    const evaluate = vi
      .fn<Parameters<UnitsHook["evaluate"]>, ReturnType<UnitsHook["evaluate"]>>()
      .mockResolvedValue({
      evaluation: { overallScore: 8, dimensions: {}, verdict: "keep" },
      brief: { focusAreas: ["Conserver la précision documentaire."] },
      assignments,
    });
    const evaluateIntegratedAction = vi.fn<
      Parameters<UnitsHook["evaluateIntegrated"]>,
      ReturnType<UnitsHook["evaluateIntegrated"]>
    >();
    mockUnits({ evaluate, evaluateIntegrated: evaluateIntegratedAction, generate });
    fetchReadiness.mockResolvedValue({
      status: "unavailable",
      reasons: [{ code: "missing_context" }],
    });
    renderPage();

    expect(await screen.findByText("Évaluation intégrée indisponible")).toBeInTheDocument();
    expect(
      screen.getByText("Aucune décision éditoriale active ne prépare cette unité.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Évaluation intégrée" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Évaluation documentaire" })).toBeEnabled();
    expect(fetchReadiness).toHaveBeenCalledWith("project-1", "unit-1");
    expect(evaluate).not.toHaveBeenCalled();
    expect(evaluateIntegratedAction).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Évaluation documentaire" }));

    expect(await screen.findByText("Verdict documentaire :")).toBeInTheDocument();
    expect(evaluate).toHaveBeenCalledWith("unit-1");
    expect(evaluateIntegratedAction).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });

  it("consults a recorded integrated evaluation as historical without triggering any action", async () => {
    const generate = vi.fn<
      Parameters<UnitsHook["generate"]>,
      ReturnType<UnitsHook["generate"]>
    >();
    const evaluate = vi.fn<
      Parameters<UnitsHook["evaluate"]>,
      ReturnType<UnitsHook["evaluate"]>
    >();
    const evaluateIntegratedAction = vi.fn<
      Parameters<UnitsHook["evaluateIntegrated"]>,
      ReturnType<UnitsHook["evaluateIntegrated"]>
    >();
    const reviseChat = vi.fn();
    mockUnits({
      evaluate,
      evaluateIntegrated: evaluateIntegratedAction,
      generate,
      reviseChat,
    });
    fetchReadiness.mockResolvedValue({ status: "unavailable", reasons: [{ code: "context_mismatch" }] });
    fetchHistory.mockResolvedValue([
      {
        id: "history-1",
        recordedAt: "2026-08-27T00:00:00.000Z",
        unitId: "unit-1",
        unitVersion: 1,
        evaluation: { overallScore: 5, verdict: "revise", dimensions: {} },
        editorialEvaluation: { overallEditorialScore: 8, summary: "L’effet éditorial était cohérent." },
        gates: { documentaryIntegrity: "fail", editorialCoherence: "pass" },
        finalVerdict: "revise",
        brief: { focusAreas: ["Renforcer les sources."] },
        assignments,
        context: {
          unitId: "unit-1",
          unitVersion: 1,
          editorialPlanId: "plan-1",
          decisionIds: ["decision-1"],
          writerProjection: { id: "writer-projection-1" },
          evaluatorProjection: { id: "evaluator-projection-1" },
          transformationTraces: [{ id: "trace-1" }],
        },
        authorDecisions: [{ id: "decision-1", version: 1, status: "active" }],
        current: false,
      } as never,
    ]);
    renderPage();

    expect(await screen.findByText("Évaluation intégrée enregistrée")).toBeInTheDocument();
    expect(screen.getByText("Historique : le texte ou la décision auteur a changé depuis ce jugement.")).toBeInTheDocument();
    expect(screen.getByText("Évaluation documentaire archivée : 5/10")).toBeInTheDocument();
    expect(screen.getByText("Évaluation éditoriale archivée : 8/10")).toBeInTheDocument();
    expect(screen.getByText("Brief archivé")).toBeInTheDocument();
    expect(screen.getByText("Plan éditorial : plan-1")).toBeInTheDocument();
    expect(screen.getByText("Décisions auteur : decision-1 (v1, active)")).toBeInTheDocument();
    expect(screen.getByText("Projections : Writer writer-projection-1 ; Evaluator evaluator-projection-1")).toBeInTheDocument();
    expect(screen.getByText("Traces Writer : trace-1")).toBeInTheDocument();
    expect(fetchHistory).toHaveBeenCalledWith("project-1", "unit-1");
    expect(evaluate).not.toHaveBeenCalled();
    expect(evaluateIntegratedAction).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
    expect(reviseChat).not.toHaveBeenCalled();
  });

  it("runs integrated evaluation only after the author selects its ready action and separates both results", async () => {
    const generate = vi.fn<
      Parameters<UnitsHook["generate"]>,
      ReturnType<UnitsHook["generate"]>
    >();
    const evaluate = vi.fn<
      Parameters<UnitsHook["evaluate"]>,
      ReturnType<UnitsHook["evaluate"]>
    >();
    const evaluateIntegratedAction = vi
      .fn<
        Parameters<UnitsHook["evaluateIntegrated"]>,
        ReturnType<UnitsHook["evaluateIntegrated"]>
      >()
      .mockResolvedValue({
      evaluation: { overallScore: 5, dimensions: {}, verdict: "keep" },
      editorialEvaluation: {
        overallEditorialScore: 8,
        contentFormCoherence: 8,
        summary: "La décision produit son effet.",
      },
      gates: { documentaryIntegrity: "fail", editorialCoherence: "pass" },
      finalVerdict: "revise",
      brief: { focusAreas: ["Renforcer le soutien documentaire."] },
      assignments,
    });
    mockUnits({ evaluate, evaluateIntegrated: evaluateIntegratedAction, generate });
    fetchReadiness.mockResolvedValue({ status: "ready" });
    renderPage();

    expect(await screen.findByText("Évaluation intégrée prête")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Évaluation intégrée" })).toBeEnabled();
    expect(evaluate).not.toHaveBeenCalled();
    expect(evaluateIntegratedAction).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Évaluation intégrée" }));

    expect(await screen.findByText("Verdict documentaire :")).toBeInTheDocument();
    expect(screen.getByText("Évaluation des effets éditoriaux")).toBeInTheDocument();
    expect(screen.getByText("Score éditorial : 8/10")).toBeInTheDocument();
    expect(screen.getByText("Porte documentaire : fail")).toBeInTheDocument();
    expect(screen.getByText("Porte éditoriale : pass")).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent === "Verdict intégré : revise")
    ).toBeInTheDocument();
    expect(screen.getByText("Affectations associées à cette évaluation")).toBeInTheDocument();
    expect(screen.getByText("Brief de révision")).toBeInTheDocument();
    expect(evaluateIntegratedAction).toHaveBeenCalledWith("unit-1");
    expect(evaluate).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });
});
