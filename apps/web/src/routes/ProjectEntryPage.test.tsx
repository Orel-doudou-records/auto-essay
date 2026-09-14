import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DraftUnit, Source } from "@auto-essay/core";
import { useUnits } from "@/hooks/useUnits";
import { useManuscriptNavigation } from "@/hooks/useManuscriptNavigation";
import { useSources } from "@/hooks/useSources";
import { ProjectEntryPage } from "./ProjectEntryPage";

vi.mock("@/hooks/useUnits", () => ({ useUnits: vi.fn() }));
vi.mock("@/hooks/useManuscriptNavigation", () => ({ useManuscriptNavigation: vi.fn() }));
vi.mock("@/hooks/useSources", () => ({ useSources: vi.fn() }));

const useProjectUnits = vi.mocked(useUnits);
const useProjectNavigation = vi.mocked(useManuscriptNavigation);
const useProjectSources = vi.mocked(useSources);

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
    mockUnits([]);
    useProjectNavigation.mockReturnValue({ entries: [], loading: false, error: null, reload: vi.fn() });
    mockSources([]);
  });

  it("offers manuscript, plan and bibliography independently for an empty project", () => {
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
    expect(screen.getByRole("link", { name: "Ajouter des sources" })).toHaveAttribute(
      "href", "/projects/project-1/sources"
    );
  });

  it("opens the latest manuscript scope when manuscript is the only active matter", async () => {
    const older = makeUnit("unit-older", "2026-09-01T10:00:00.000Z");
    const recent = makeUnit("unit-recent", "2026-09-02T10:00:00.000Z");
    mockUnits([older, recent]);

    renderEntry();

    expect(await screen.findByTestId("location")).toHaveTextContent(
      "/projects/project-1/editor?unitId=unit-recent"
    );
  });

  it("opens the first planned chapter when plan is the only active matter", async () => {
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

  it("opens sources when bibliography is the only active matter", async () => {
    mockSources([makeSource("source-1")]);

    renderEntry();

    expect(await screen.findByTestId("location")).toHaveTextContent(
      "/projects/project-1/sources"
    );
  });

  it("keeps manuscript, plan and bibliography visible together when all three coexist", () => {
    mockUnits([makeUnit("unit-1", "2026-09-02T10:00:00.000Z")]);
    useProjectNavigation.mockReturnValue({
      entries: [{ kind: "node", id: "chapter-1", title: "Ouverture", children: [] }],
      loading: false,
      error: null,
      reload: vi.fn(),
    });
    mockSources([makeSource("source-1")]);

    renderEntry();

    expect(screen.getByRole("heading", { name: "Reprendre votre essai" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reprendre le manuscrit" })).toHaveAttribute(
      "href", "/projects/project-1/editor?unitId=unit-1"
    );
    expect(screen.getByRole("link", { name: "Reprendre le plan" })).toHaveAttribute(
      "href", "/projects/project-1/chapitre?chapterId=chapter-1"
    );
    expect(screen.getByRole("link", { name: "Reprendre les sources" })).toHaveAttribute(
      "href", "/projects/project-1/sources"
    );
    expect(screen.getByText(/même si d’autres parties du livre restent provisoires/i)).toBeInTheDocument();
  });
});

function mockUnits(units: DraftUnit[]) {
  useProjectUnits.mockReturnValue({
    units,
    loading: false,
    error: null,
    reload: vi.fn(),
    add: vi.fn(),
    update: vi.fn(),
    generate: vi.fn(),
    split: vi.fn(),
    mergeNext: vi.fn(),
    reviseChat: vi.fn(),
    evaluate: vi.fn(),
    evaluateIntegrated: vi.fn(),
    verify: vi.fn(),
  });
}

function mockSources(sources: Source[]) {
  useProjectSources.mockReturnValue({
    sources,
    loading: false,
    error: null,
    reload: vi.fn(),
    importFiles: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  });
}

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

function makeSource(id: string): Source {
  return {
    id,
    projectId: "project-1",
    type: "note",
    title: "Source",
    authors: [],
    content: "Contenu documentaire",
    annotations: [],
    epistemicLimits: [],
    verificationStatus: "verified",
    tags: [],
  };
}
