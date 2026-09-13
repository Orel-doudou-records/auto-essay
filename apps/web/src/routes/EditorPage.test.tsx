import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DraftUnit, RevisionProposal } from "@auto-essay/core";
import { useUnits } from "@/hooks/useUnits";
import { useManuscriptNavigation } from "@/hooks/useManuscriptNavigation";
import { EditorPage } from "./EditorPage";

vi.mock("@/hooks/useUnits", () => ({ useUnits: vi.fn() }));
vi.mock("@/hooks/useManuscriptNavigation", () => ({ useManuscriptNavigation: vi.fn() }));
vi.mock("@/api", () => ({ exportProject: vi.fn() }));

const useProjectUnits = vi.mocked(useUnits);
const useProjectNavigation = vi.mocked(useManuscriptNavigation);
const updateUnit = vi.fn();
const splitUnit = vi.fn();
const mergeNextUnit = vi.fn();

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

function mockUnits(overrides: Partial<ReturnType<typeof useUnits>> = {}) {
  useProjectUnits.mockReturnValue({
    units: [preparedUnit],
    loading: false,
    error: null,
    reload: vi.fn(),
    add: vi.fn(),
    update: updateUnit,
    generate: vi.fn(),
    split: splitUnit,
    mergeNext: mergeNextUnit,
    reviseChat: vi.fn(),
    evaluate: vi.fn(),
    evaluateIntegrated: vi.fn(),
    verify: vi.fn(),
    ...overrides,
  });
}

function renderEditor(entry = "/projects/project-1/editor?unitId=unit-prepared") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes><Route path="/projects/:projectId/editor" element={<EditorPage />} /></Routes>
    </MemoryRouter>
  );
}

describe("EditorPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    updateUnit.mockResolvedValue(preparedUnit);
    mockUnits();
    useProjectNavigation.mockReturnValue({ entries: [], loading: false, error: null, reload: vi.fn() });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens the requested prepared draft unit from the URL", async () => {
    renderEditor();
    expect(await screen.findByRole("heading", { name: "Unité préparée" })).toBeInTheDocument();
  });

  it("lets the author explicitly split an imported section after it is saved", async () => {
    const importedUnit = {
      ...preparedUnit,
      id: "unit-imported",
      granularity: "section" as const,
      thesis: "Ouverture",
      content: "Premier paragraphe.\n\nDeuxième paragraphe.",
      appliedDecisionIds: [],
      appliedArticulationIds: [],
    };
    const firstParagraph = { ...importedUnit, id: "paragraph-1", granularity: "paragraph" as const, content: "Premier paragraphe." };
    const secondParagraph = { ...importedUnit, id: "paragraph-2", granularity: "paragraph" as const, content: "Deuxième paragraphe." };
    splitUnit.mockResolvedValue({ units: [firstParagraph, secondParagraph], unitIds: [firstParagraph.id, secondParagraph.id] });
    mockUnits({ units: [importedUnit] });
    renderEditor("/projects/project-1/editor?unitId=unit-imported");

    const split = await screen.findByRole("button", { name: "Scinder en paragraphes" });
    expect(split).toBeEnabled();
    fireEvent.click(split);

    await vi.waitFor(() => expect(splitUnit).toHaveBeenCalledWith("unit-imported"));
    expect(await screen.findByRole("textbox", { name: "Manuscrit : Ouverture" })).toHaveValue("Premier paragraphe.");
  });

  it("saves after a short pause and keeps the author informed", async () => {
    renderEditor();
    const manuscript = await screen.findByRole("textbox", { name: "Manuscrit : Unité préparée" });
    vi.useFakeTimers();
    fireEvent.change(manuscript, { target: { value: "Un texte révisé." } });

    expect(screen.getByText("Modifications à enregistrer")).toBeInTheDocument();
    expect(updateUnit).not.toHaveBeenCalled();
    await act(async () => void await vi.advanceTimersByTimeAsync(600));

    expect(updateUnit).toHaveBeenCalledWith("unit-prepared", { content: "Un texte révisé." });
    expect(screen.getByText("Enregistré")).toBeInTheDocument();
  });

  it("shows an in-progress save before confirming persistence", async () => {
    let resolveSave: (unit: DraftUnit) => void = () => undefined;
    updateUnit.mockImplementationOnce(() => new Promise<DraftUnit>((resolve) => { resolveSave = resolve; }));
    renderEditor();
    const manuscript = await screen.findByRole("textbox", { name: "Manuscrit : Unité préparée" });
    vi.useFakeTimers();
    fireEvent.change(manuscript, { target: { value: "Un texte en attente." } });

    await act(async () => void await vi.advanceTimersByTimeAsync(600));
    expect(screen.getByText("Enregistrement…")).toBeInTheDocument();
    await act(async () => { resolveSave(preparedUnit); await Promise.resolve(); });
    expect(screen.getByText("Enregistré")).toBeInTheDocument();
  });

  it("keeps a newer local change pending when an older save finishes", async () => {
    let resolveFirstSave: (unit: DraftUnit) => void = () => undefined;
    updateUnit.mockImplementationOnce(() => new Promise<DraftUnit>((resolve) => { resolveFirstSave = resolve; }));
    renderEditor();
    const manuscript = await screen.findByRole("textbox", { name: "Manuscrit : Unité préparée" });
    vi.useFakeTimers();
    fireEvent.change(manuscript, { target: { value: "Première version." } });
    await act(async () => void await vi.advanceTimersByTimeAsync(600));
    expect(screen.getByText("Enregistrement…")).toBeInTheDocument();

    fireEvent.change(manuscript, { target: { value: "Version plus récente." } });
    expect(screen.getByText("Modifications à enregistrer")).toBeInTheDocument();
    await act(async () => { resolveFirstSave(preparedUnit); await Promise.resolve(); });

    expect(screen.getByText("Modifications à enregistrer")).toBeInTheDocument();
    expect(manuscript).toHaveValue("Version plus récente.");
  });

  it("reports a failed automatic save without losing the editor", async () => {
    updateUnit.mockRejectedValueOnce(new Error("Écriture indisponible"));
    renderEditor();
    const manuscript = await screen.findByRole("textbox", { name: "Manuscrit : Unité préparée" });
    vi.useFakeTimers();
    fireEvent.change(manuscript, { target: { value: "Un texte à conserver localement." } });
    await act(async () => void await vi.advanceTimersByTimeAsync(600));

    expect(screen.getByText("Échec de l’enregistrement")).toBeInTheDocument();
    expect(manuscript).toHaveValue("Un texte à conserver localement.");
  });

  it("offers only the agreed calm starting actions when no unit is selected", () => {
    mockUnits({ units: [] });
    renderEditor("/projects/project-1/editor");

    const emptyState = screen.getByRole("region", { name: "Aucune section sélectionnée" });
    expect(within(emptyState).getByRole("heading", { name: "Un espace pour écrire." })).toBeInTheDocument();
    expect(within(emptyState).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Ajouter une section",
      "Choisir dans le manuscrit",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir les outils" }));
    expect(screen.queryByRole("complementary", { name: "Inspecteur éditorial" })).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Structure du manuscrit" })).toBeInTheDocument();
  });

  it("creates the first editable section from the project entry path", async () => {
    const add = vi.fn().mockResolvedValue(preparedUnit);
    mockUnits({ units: [], add });
    renderEditor("/projects/project-1/editor?new=1");

    expect(screen.getByRole("heading", { name: "Commencer à écrire" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Titre de votre première section"), { target: { value: "Ouverture" } });
    fireEvent.click(screen.getByRole("button", { name: "Créer et écrire" }));

    await vi.waitFor(() => expect(add).toHaveBeenCalledWith("Ouverture"));
    expect(await screen.findByRole("textbox", { name: "Manuscrit : Unité préparée" })).toBeInTheDocument();
  });

  it("prevents duplicate creation and reports a failed first section", async () => {
    const add = vi.fn().mockRejectedValue(new Error("offline"));
    mockUnits({ units: [], add });
    renderEditor("/projects/project-1/editor?new=1");

    fireEvent.change(screen.getByLabelText("Titre de votre première section"), { target: { value: "Ouverture" } });
    fireEvent.click(screen.getByRole("button", { name: "Créer et écrire" }));
    fireEvent.click(screen.getByRole("button", { name: "Création…" }));

    await vi.waitFor(() => expect(add).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("alert")).toHaveTextContent("La section n’a pas pu être créée. Réessayez.");
  });

  it("keeps a revision proposal separate, editable, explicit and stale after manuscript changes", async () => {
    const proposal: RevisionProposal = {
      id: "proposal-1", projectId: "project-1", unitId: "unit-prepared", sourceVersion: 1,
      before: "", content: "Proposition initiale.", status: "available",
      createdAt: "2026-08-27T12:00:00.000Z", updatedAt: "2026-08-27T12:00:00.000Z",
    };
    const reviseChat = vi.fn().mockResolvedValue({ proposal });
    mockUnits({ reviseChat });
    renderEditor();
    const manuscript = await screen.findByRole("textbox", { name: "Manuscrit : Unité préparée" });
    fireEvent.change(screen.getByRole("textbox", { name: "Instruction de révision" }), { target: { value: "Resserre le passage." } });
    fireEvent.click(screen.getByRole("button", { name: "Réviser" }));
    expect(await screen.findByRole("region", { name: "Proposition de révision" })).toBeInTheDocument();
    expect(manuscript).toHaveValue("");
    expect(updateUnit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: "Texte proposé" }), { target: { value: "Proposition éditée." } });
    fireEvent.click(screen.getByRole("button", { name: "Appliquer la proposition" }));
    expect(updateUnit).toHaveBeenCalledWith("unit-prepared", { content: "Proposition éditée.", version: 2 });

    reviseChat.mockResolvedValueOnce({ proposal });
    fireEvent.change(screen.getByRole("textbox", { name: "Instruction de révision" }), { target: { value: "Nouvelle proposition." } });
    fireEvent.click(screen.getByRole("button", { name: "Réviser" }));
    await screen.findByRole("region", { name: "Proposition de révision" });
    fireEvent.change(manuscript, { target: { value: "Le manuscrit a changé." } });
    expect(screen.getByText("Proposition périmée")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Appliquer la proposition" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Refuser la proposition" }));
    expect(screen.queryByRole("region", { name: "Proposition de révision" })).not.toBeInTheDocument();
  });

  it("shows book structure and editorial context by default for the selected scope and lets the author collapse them", async () => {
    renderEditor();
    await screen.findByRole("heading", { name: "Unité préparée" });

    expect(screen.getByRole("navigation", { name: "Structure du manuscrit" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Inspecteur éditorial" })).toBeInTheDocument();
    expect(screen.getByText("Contexte du scope · Paragraphe")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Générer une version" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fermer la navigation" }));
    expect(screen.queryByRole("navigation", { name: "Structure du manuscrit" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir la navigation" }));
    expect(screen.getByRole("navigation", { name: "Structure du manuscrit" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fermer les outils" }));
    expect(screen.queryByRole("complementary", { name: "Inspecteur éditorial" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir les outils" }));
    expect(screen.getByRole("complementary", { name: "Inspecteur éditorial" })).toBeInTheDocument();
  });

  it("selects chapters, sections and paragraphs from one visible manuscript hierarchy", async () => {
    useProjectNavigation.mockReturnValue({
      entries: [{
        kind: "node",
        id: "chapter-1",
        title: "Ouverture",
        children: [{
          kind: "node",
          id: "section-1",
          title: "Le point de départ",
          children: [{
            kind: "leaf",
            unitId: "unit-prepared",
            version: 1,
            status: "drafting",
            granularity: "paragraph",
          }],
        }],
      }],
      loading: false,
      error: null,
      reload: vi.fn(),
    });
    renderEditor();

    const navigation = await screen.findByRole("navigation", { name: "Structure du manuscrit" });
    fireEvent.click(within(navigation).getByRole("button", { name: "Ouverture" }));
    expect(screen.getByRole("region", { name: "Scope courant : Ouverture" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Travailler le plan du chapitre" })).toHaveAttribute(
      "href", "/projects/project-1/chapitre?chapterId=chapter-1"
    );
    expect(screen.getByRole("complementary", { name: "Inspecteur éditorial" })).toHaveTextContent("Ouverture");

    fireEvent.click(within(navigation).getByRole("button", { name: "Le point de départ" }));
    expect(screen.getByRole("region", { name: "Scope courant : Le point de départ" })).toBeInTheDocument();

    fireEvent.click(within(navigation).getByRole("button", { name: /Paragraphe 1/ }));
    expect(await screen.findByRole("textbox", { name: "Manuscrit : Unité préparée" })).toBeInTheDocument();
    expect(screen.getByText("Contexte du scope · Paragraphe")).toBeInTheDocument();
  });

  it("explains when manuscript navigation cannot be loaded", () => {
    useProjectNavigation.mockReturnValue({ entries: [], loading: false, error: new Error("Navigation indisponible"), reload: vi.fn() });
    renderEditor();
    expect(screen.getByText("Navigation indisponible")).toBeInTheDocument();
  });
});
