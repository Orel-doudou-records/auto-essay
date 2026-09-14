import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DraftUnit, RevisionProposal } from "@auto-essay/core";
import { useUnits } from "@/hooks/useUnits";
import { useManuscriptNavigation } from "@/hooks/useManuscriptNavigation";
import { EditorPage } from "./EditorPage";

vi.mock("@/hooks/useUnits", () => ({ useUnits: vi.fn() }));
vi.mock("@/hooks/useManuscriptNavigation", () => ({ useManuscriptNavigation: vi.fn() }));
vi.mock("@/api", () => ({ exportProject: vi.fn() }));
vi.mock("@/components/editor/ScopeConversation", () => ({
  ScopeConversation: ({ scope }: { scope: { kind: string; id: string } }) => (
    <section aria-label="Contexte situé">{scope.kind}:{scope.id}</section>
  ),
}));
vi.mock("@/components/editorial/PlanV2Panel", () => ({
  PlanV2Panel: ({ chapterId }: { chapterId: string }) => <section aria-label="Préparation du plan">{chapterId}</section>,
}));

const useProjectUnits = vi.mocked(useUnits);
const useProjectNavigation = vi.mocked(useManuscriptNavigation);
const originalMatchMedia = window.matchMedia;
const updateUnit = vi.fn();

const preparedUnit: DraftUnit = {
  id: "unit-prepared",
  projectId: "project-1",
  granularity: "paragraph",
  targetWordCount: 200,
  thesis: "Unité préparée",
  contextInPlan: { section: "section-1" },
  evidencePack: { sourceIds: [], keyCitations: [], supportingClaimIds: [], objections: [] },
  content: "Texte initial.",
  claimIds: [],
  citationUses: [],
  appliedDecisionIds: [],
  appliedArticulationIds: [],
  transformationTraceIds: [],
  status: "drafting",
  version: 1,
  createdAt: "2026-09-14T06:00:00.000Z",
  updatedAt: "2026-09-14T06:00:00.000Z",
};

function installCompactViewport() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function mockUnits(reviseChat = vi.fn()) {
  useProjectUnits.mockReturnValue({
    units: [preparedUnit],
    loading: false,
    error: null,
    reload: vi.fn(),
    add: vi.fn(),
    update: updateUnit,
    generate: vi.fn(),
    split: vi.fn(),
    mergeNext: vi.fn(),
    reviseChat,
    evaluate: vi.fn(),
    evaluateIntegrated: vi.fn(),
    verify: vi.fn(),
  });
}

function mockNavigation() {
  useProjectNavigation.mockReturnValue({
    entries: [{
      kind: "node",
      id: "chapter-1",
      title: "Ouverture",
      children: [{
        kind: "leaf",
        unitId: preparedUnit.id,
        version: preparedUnit.version,
        status: preparedUnit.status,
        granularity: preparedUnit.granularity,
      }],
    }],
    loading: false,
    error: null,
    reload: vi.fn(),
  });
}

function renderEditor() {
  return render(
    <MemoryRouter initialEntries={["/projects/project-1/editor?unitId=unit-prepared"]}>
      <Routes><Route path="/projects/:projectId/editor" element={<EditorPage />} /></Routes>
    </MemoryRouter>
  );
}

describe("EditorPage responsive workspace", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    installCompactViewport();
    updateUnit.mockResolvedValue(preparedUnit);
    mockUnits();
    mockNavigation();
  });

  afterEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    });
  });

  it("keeps the manuscript primary while navigation and context remain reachable from the same scope", async () => {
    renderEditor();

    const manuscript = await screen.findByRole("textbox", { name: "Manuscrit : Unité préparée" });
    expect(manuscript).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Structure du manuscrit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Inspecteur éditorial" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ouvrir la navigation" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Ouvrir les outils" })).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(screen.getByRole("button", { name: "Ouvrir la navigation" }));
    const navigation = screen.getByRole("navigation", { name: "Structure du manuscrit" });
    expect(screen.queryByRole("complementary", { name: "Inspecteur éditorial" })).not.toBeInTheDocument();
    expect(within(navigation).getByRole("button", { name: /Paragraphe 1/ })).toHaveAttribute("aria-current", "location");

    fireEvent.click(within(navigation).getByRole("button", { name: "Ouverture" }));
    expect(screen.queryByRole("navigation", { name: "Structure du manuscrit" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Scope courant : Ouverture" })).toBeInTheDocument();
    expect(screen.getByText("· Ouverture")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ouvrir la navigation" }));
    fireEvent.click(within(screen.getByRole("navigation", { name: "Structure du manuscrit" })).getByRole("button", { name: /Paragraphe 1/ }));
    expect(screen.queryByRole("navigation", { name: "Structure du manuscrit" })).not.toBeInTheDocument();
    expect(await screen.findByRole("textbox", { name: "Manuscrit : Unité préparée" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ouvrir les outils" }));
    expect(screen.queryByRole("navigation", { name: "Structure du manuscrit" })).not.toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Inspecteur éditorial" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Contexte situé" })).toHaveTextContent("unit:unit-prepared");
    expect(screen.getByText("· Unité préparée")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("complementary", { name: "Inspecteur éditorial" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Manuscrit : Unité préparée" })).toBeInTheDocument();
  });

  it("keeps revision proposals editable, rejectable and explicitly applicable from the compact context dock", async () => {
    const proposal: RevisionProposal = {
      id: "proposal-mobile",
      projectId: "project-1",
      unitId: preparedUnit.id,
      sourceVersion: preparedUnit.version,
      before: preparedUnit.content,
      content: "Proposition mobile.",
      status: "available",
      createdAt: "2026-09-14T06:00:00.000Z",
      updatedAt: "2026-09-14T06:00:00.000Z",
    };
    const reviseChat = vi.fn().mockResolvedValue({ proposal });
    mockUnits(reviseChat);
    updateUnit.mockResolvedValue({ ...preparedUnit, content: "Proposition appliquée.", version: 2 });
    renderEditor();
    await screen.findByRole("textbox", { name: "Manuscrit : Unité préparée" });

    fireEvent.click(screen.getByRole("button", { name: "Ouvrir les outils" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Instruction de révision" }), { target: { value: "Resserre." } });
    fireEvent.click(screen.getByRole("button", { name: "Réviser" }));
    expect(await screen.findByRole("region", { name: "Proposition de révision" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Texte proposé" }), { target: { value: "Version mobile éditée." } });
    fireEvent.click(screen.getByRole("button", { name: "Refuser la proposition" }));
    expect(screen.queryByRole("region", { name: "Proposition de révision" })).not.toBeInTheDocument();
    expect(updateUnit).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole("textbox", { name: "Instruction de révision" }), { target: { value: "Resserre encore." } });
    fireEvent.click(screen.getByRole("button", { name: "Réviser" }));
    await screen.findByRole("region", { name: "Proposition de révision" });
    fireEvent.change(screen.getByRole("textbox", { name: "Texte proposé" }), { target: { value: "Proposition appliquée." } });
    fireEvent.click(screen.getByRole("button", { name: "Appliquer la proposition" }));

    expect(updateUnit).toHaveBeenCalledWith(preparedUnit.id, { content: "Proposition appliquée.", version: 2 });
  });
});