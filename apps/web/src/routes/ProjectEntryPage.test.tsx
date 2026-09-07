import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DraftUnit } from "@auto-essay/core";
import { useUnits } from "@/hooks/useUnits";
import { useManuscriptNavigation } from "@/hooks/useManuscriptNavigation";
import { ProjectEntryPage } from "./ProjectEntryPage";

vi.mock("@/hooks/useUnits", () => ({ useUnits: vi.fn() }));
vi.mock("@/hooks/useManuscriptNavigation", () => ({ useManuscriptNavigation: vi.fn() }));

const useProjectUnits = vi.mocked(useUnits);
const useProjectNavigation = vi.mocked(useManuscriptNavigation);

function Location() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname}{location.search}</p>;
}

function renderEntry() {
  return render(
    <MemoryRouter initialEntries={["/projects/project-1"]}>
      <Routes>
        <Route path="/projects/:projectId" element={<ProjectEntryPage />} />
        <Route path="*" element={<Location />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ProjectEntryPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useProjectNavigation.mockReturnValue({ entries: [], loading: false, error: null, reload: vi.fn() });
  });

  it("offers import and starting to write with equal prominence for an empty project", () => {
    useProjectUnits.mockReturnValue({
      units: [], loading: false, error: null, reload: vi.fn(), add: vi.fn(), update: vi.fn(),
      generate: vi.fn(), split: vi.fn(), mergeNext: vi.fn(), reviseChat: vi.fn(), evaluate: vi.fn(), evaluateIntegrated: vi.fn(), verify: vi.fn(),
    });
    renderEntry();

    expect(screen.getByRole("link", { name: "Importer un manuscrit" })).toHaveAttribute(
      "href", "/projects/project-1/import"
    );
    expect(screen.getByRole("link", { name: "Importer un plan" })).toHaveAttribute(
      "href", "/projects/project-1/plan-import"
    );
    expect(screen.getByRole("link", { name: "Créer la première section" })).toHaveAttribute(
      "href", "/projects/project-1/editor?new=1"
    );
  });

  it("reopens the most recently worked unit", async () => {
    const older = makeUnit("unit-older", "2026-09-01T10:00:00.000Z");
    const recent = makeUnit("unit-recent", "2026-09-02T10:00:00.000Z");
    useProjectUnits.mockReturnValue({
      units: [older, recent], loading: false, error: null, reload: vi.fn(), add: vi.fn(), update: vi.fn(),
      generate: vi.fn(), split: vi.fn(), mergeNext: vi.fn(), reviseChat: vi.fn(), evaluate: vi.fn(), evaluateIntegrated: vi.fn(), verify: vi.fn(),
    });
    renderEntry();

    expect(await screen.findByTestId("location")).toHaveTextContent(
      "/projects/project-1/editor?unitId=unit-recent"
    );
  });

  it("opens the first planned chapter when the project has no written section", async () => {
    useProjectUnits.mockReturnValue({
      units: [], loading: false, error: null, reload: vi.fn(), add: vi.fn(), update: vi.fn(),
      generate: vi.fn(), split: vi.fn(), mergeNext: vi.fn(), reviseChat: vi.fn(), evaluate: vi.fn(), evaluateIntegrated: vi.fn(), verify: vi.fn(),
    });
    useProjectNavigation.mockReturnValue({
      entries: [{ kind: "node", id: "chapter-1", title: "Ouverture", children: [] }],
      loading: false,
      error: null,
      reload: vi.fn(),
    });
    renderEntry();

    expect(await screen.findByTestId("location")).toHaveTextContent(
      "/projects/project-1/chapitre?chapterId=chapter-1"
    );
  });
});

function makeUnit(id: string, updatedAt: string): DraftUnit {
  return {
    id,
    projectId: "project-1",
    granularity: "section",
    targetWordCount: 1200,
    thesis: "Section",
    evidencePack: { sourceIds: [], keyCitations: [], supportingClaimIds: [], objections: [] },
    content: "",
    claimIds: [],
    citationUses: [],
    appliedDecisionIds: [],
    appliedArticulationIds: [],
    transformationTraceIds: [],
    status: "drafting",
    version: 1,
    createdAt: updatedAt,
    updatedAt,
  };
}
