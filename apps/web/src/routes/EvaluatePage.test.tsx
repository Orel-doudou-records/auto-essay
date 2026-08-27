import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDraftUnit } from "@auto-essay/core";
import { fetchEvaluationJudgeAssignments } from "@/api";
import { useUnits } from "@/hooks/useUnits";
import { EvaluatePage } from "./EvaluatePage";

vi.mock("@/api", () => ({
  fetchEvaluationJudgeAssignments: vi.fn(),
}));
vi.mock("@/hooks/useUnits", () => ({ useUnits: vi.fn() }));

const fetchAssignments = vi.mocked(fetchEvaluationJudgeAssignments);
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

describe("EvaluatePage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockUseUnits.mockReturnValue({
      units: [unit],
      loading: false,
      error: null,
      reload: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
      generate: vi.fn(),
      reviseChat: vi.fn(),
      evaluate: vi.fn(),
      verify: vi.fn(),
    });
  });

  it("shows judge assignments before and after an explicit evaluation without generation", async () => {
    const generate = vi.fn();
    const evaluate = vi.fn().mockResolvedValue({
      evaluation: { overallScore: 8, dimensions: {}, verdict: "keep" },
      brief: { focusAreas: ["Conserver la précision documentaire."] },
      assignments,
    });
    mockUseUnits.mockReturnValue({
      units: [unit],
      loading: false,
      error: null,
      reload: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
      generate,
      reviseChat: vi.fn(),
      evaluate,
      verify: vi.fn(),
    });
    fetchAssignments.mockResolvedValue(assignments);
    renderPage();

    expect(await screen.findByText("Juge documentaire")).toBeInTheDocument();
    expect(screen.getByText("documentary-judge-model")).toBeInTheDocument();
    expect(screen.getByText("judge-documentary")).toBeInTheDocument();
    expect(screen.getByText("documentary_evaluation")).toBeInTheDocument();
    expect(screen.getByText("Juge éditorial")).toBeInTheDocument();
    expect(screen.getByText("editorial-judge-model")).toBeInTheDocument();
    expect(screen.getByText("judge-editorial")).toBeInTheDocument();
    expect(screen.getByText("editorial_effect_evaluation")).toBeInTheDocument();
    expect(screen.getAllByText("specialty_matches_work_type")).toHaveLength(2);
    expect(fetchAssignments).toHaveBeenCalledWith("project-1", "unit-1");
    expect(evaluate).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Évaluer" }));

    expect(await screen.findByText("Affectations associées à cette évaluation")).toBeInTheDocument();
    expect(screen.getByText("Score global : 8/10")).toBeInTheDocument();
    expect(screen.getByText("Brief de révision")).toBeInTheDocument();
    expect(evaluate).toHaveBeenCalledWith("unit-1");
    expect(generate).not.toHaveBeenCalled();
  });
});
