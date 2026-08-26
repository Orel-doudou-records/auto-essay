import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DraftUnit } from "@auto-essay/core";
import { useUnits } from "@/hooks/useUnits";
import { EditorPage } from "./EditorPage";

vi.mock("@/hooks/useUnits", () => ({ useUnits: vi.fn() }));
vi.mock("@/api", () => ({ exportProject: vi.fn() }));

const useProjectUnits = vi.mocked(useUnits);

const preparedUnit: DraftUnit = {
  id: "unit-prepared",
  projectId: "project-1",
  granularity: "paragraph",
  targetWordCount: 200,
  thesis: "Unité préparée",
  contextInPlan: { section: "section-1" },
  evidencePack: {
    sourceIds: ["source-qualified"],
    keyCitations: [],
    supportingClaimIds: [],
    objections: [],
  },
  content: "",
  claimIds: [],
  citationUses: [],
  appliedDecisionIds: ["decision-1"],
  appliedArticulationIds: ["proposal-1"],
  transformationTraceIds: [],
  status: "drafting",
  version: 1,
  createdAt: "2026-08-26T12:00:00.000Z",
  updatedAt: "2026-08-26T12:00:00.000Z",
};

describe("EditorPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useProjectUnits.mockReturnValue({
      units: [preparedUnit],
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

  it("opens the requested prepared draft unit from the URL", async () => {
    render(
      <MemoryRouter initialEntries={["/projects/project-1/editor?unitId=unit-prepared"]}>
        <Routes>
          <Route path="/projects/:projectId/editor" element={<EditorPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Unité préparée" })).toBeInTheDocument();
  });
});
