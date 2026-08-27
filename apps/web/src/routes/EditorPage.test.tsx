import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DraftUnit } from "@auto-essay/core";
import { useUnits } from "@/hooks/useUnits";
import { EditorPage } from "./EditorPage";

vi.mock("@/hooks/useUnits", () => ({ useUnits: vi.fn() }));
vi.mock("@/api", () => ({ exportProject: vi.fn() }));

const useProjectUnits = vi.mocked(useUnits);
const updateUnit = vi.fn();

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
    updateUnit.mockResolvedValue(preparedUnit);
    useProjectUnits.mockReturnValue({
      units: [preparedUnit],
      loading: false,
      error: null,
      reload: vi.fn(),
      add: vi.fn(),
      update: updateUnit,
      generate: vi.fn(),
      reviseChat: vi.fn(),
      evaluate: vi.fn(),
      evaluateIntegrated: vi.fn(),
      verify: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it("saves after a short pause and keeps the author informed", async () => {
    render(
      <MemoryRouter initialEntries={["/projects/project-1/editor?unitId=unit-prepared"]}>
        <Routes>
          <Route path="/projects/:projectId/editor" element={<EditorPage />} />
        </Routes>
      </MemoryRouter>
    );

    const manuscript = await screen.findByRole("textbox", { name: "Manuscrit : Unité préparée" });
    vi.useFakeTimers();
    fireEvent.change(manuscript, { target: { value: "Un texte révisé." } });

    expect(screen.getByText("Modifications à enregistrer")).toBeInTheDocument();
    expect(updateUnit).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(updateUnit).toHaveBeenCalledWith("unit-prepared", { content: "Un texte révisé." });
    expect(screen.getByText("Enregistré")).toBeInTheDocument();
  });

  it("shows an in-progress save before confirming persistence", async () => {
    let resolveSave: (unit: DraftUnit) => void = () => undefined;
    updateUnit.mockImplementationOnce(() => new Promise<DraftUnit>((resolve) => {
      resolveSave = resolve;
    }));
    render(
      <MemoryRouter initialEntries={["/projects/project-1/editor?unitId=unit-prepared"]}>
        <Routes>
          <Route path="/projects/:projectId/editor" element={<EditorPage />} />
        </Routes>
      </MemoryRouter>
    );

    const manuscript = await screen.findByRole("textbox", { name: "Manuscrit : Unité préparée" });
    vi.useFakeTimers();
    fireEvent.change(manuscript, { target: { value: "Un texte en attente." } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(screen.getByText("Enregistrement…")).toBeInTheDocument();

    await act(async () => {
      resolveSave(preparedUnit);
      await Promise.resolve();
    });
    expect(screen.getByText("Enregistré")).toBeInTheDocument();
  });

  it("keeps a newer local change pending when an older save finishes", async () => {
    let resolveFirstSave: (unit: DraftUnit) => void = () => undefined;
    updateUnit.mockImplementationOnce(() => new Promise<DraftUnit>((resolve) => {
      resolveFirstSave = resolve;
    }));
    render(
      <MemoryRouter initialEntries={["/projects/project-1/editor?unitId=unit-prepared"]}>
        <Routes>
          <Route path="/projects/:projectId/editor" element={<EditorPage />} />
        </Routes>
      </MemoryRouter>
    );

    const manuscript = await screen.findByRole("textbox", { name: "Manuscrit : Unité préparée" });
    vi.useFakeTimers();
    fireEvent.change(manuscript, { target: { value: "Première version." } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(screen.getByText("Enregistrement…")).toBeInTheDocument();

    fireEvent.change(manuscript, { target: { value: "Version plus récente." } });
    expect(screen.getByText("Modifications à enregistrer")).toBeInTheDocument();
    await act(async () => {
      resolveFirstSave(preparedUnit);
      await Promise.resolve();
    });

    expect(screen.getByText("Modifications à enregistrer")).toBeInTheDocument();
    expect(manuscript).toHaveValue("Version plus récente.");
  });

  it("reports a failed automatic save without losing the editor", async () => {
    updateUnit.mockRejectedValueOnce(new Error("Écriture indisponible"));
    render(
      <MemoryRouter initialEntries={["/projects/project-1/editor?unitId=unit-prepared"]}>
        <Routes>
          <Route path="/projects/:projectId/editor" element={<EditorPage />} />
        </Routes>
      </MemoryRouter>
    );

    const manuscript = await screen.findByRole("textbox", { name: "Manuscrit : Unité préparée" });
    vi.useFakeTimers();
    fireEvent.change(manuscript, { target: { value: "Un texte à conserver localement." } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(screen.getByText("Échec de l’enregistrement")).toBeInTheDocument();
    expect(manuscript).toHaveValue("Un texte à conserver localement.");
  });

  it("offers only the agreed calm starting actions when no unit is selected", () => {
    useProjectUnits.mockReturnValue({
      units: [],
      loading: false,
      error: null,
      reload: vi.fn(),
      add: vi.fn(),
      update: updateUnit,
      generate: vi.fn(),
      reviseChat: vi.fn(),
      evaluate: vi.fn(),
      evaluateIntegrated: vi.fn(),
      verify: vi.fn(),
    });
    render(
      <MemoryRouter initialEntries={["/projects/project-1/editor"]}>
        <Routes>
          <Route path="/projects/:projectId/editor" element={<EditorPage />} />
        </Routes>
      </MemoryRouter>
    );

    const emptyState = screen.getByRole("region", { name: "Aucune unité sélectionnée" });
    expect(within(emptyState).getByRole("heading", { name: "Un espace pour écrire." })).toBeInTheDocument();
    expect(within(emptyState).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Créer une unité",
      "Choisir dans le manuscrit",
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Ouvrir les outils" }));
    expect(screen.queryByRole("complementary", { name: "Inspecteur éditorial" })).not.toBeInTheDocument();
    fireEvent.click(within(emptyState).getByRole("button", { name: "Choisir dans le manuscrit" }));
    expect(screen.getByRole("navigation", { name: "Unités du manuscrit" })).toBeInTheDocument();
  });

  it("keeps manuscript navigation and the editorial inspector closed until the author opens them", async () => {
    render(
      <MemoryRouter initialEntries={["/projects/project-1/editor?unitId=unit-prepared"]}>
        <Routes>
          <Route path="/projects/:projectId/editor" element={<EditorPage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByRole("heading", { name: "Unité préparée" });
    expect(screen.queryByRole("navigation", { name: "Unités du manuscrit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Inspecteur éditorial" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Générer une version" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ouvrir la navigation" }));
    expect(screen.getByRole("navigation", { name: "Unités du manuscrit" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fermer la navigation" }));
    expect(screen.queryByRole("navigation", { name: "Unités du manuscrit" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ouvrir les outils" }));
    expect(screen.getByRole("complementary", { name: "Inspecteur éditorial" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Révision assistée" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Générer une version" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fermer les outils" }));
    expect(screen.queryByRole("complementary", { name: "Inspecteur éditorial" })).not.toBeInTheDocument();
  });
});
