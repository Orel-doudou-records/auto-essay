import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorWorkshopPage } from "./AuthorWorkshopPage";
import {
  acceptEditorialProposal,
  fetchEditorialSectionContext,
  modifyEditorialProposal,
  rejectEditorialProposal,
  runEditorialSectionReading,
} from "@/api";

vi.mock("@/api", () => ({
  fetchEditorialSectionContext: vi.fn(),
  runEditorialSectionReading: vi.fn(),
  acceptEditorialProposal: vi.fn(),
  modifyEditorialProposal: vi.fn(),
  rejectEditorialProposal: vi.fn(),
}));

const fetchContext = vi.mocked(fetchEditorialSectionContext);
const runReading = vi.mocked(runEditorialSectionReading);
const acceptProposal = vi.mocked(acceptEditorialProposal);
const modifyProposal = vi.mocked(modifyEditorialProposal);
const rejectProposal = vi.mocked(rejectEditorialProposal);

const context = {
  projectId: "project-1",
  section: { id: "section-1", title: "Section réelle" },
  bookParts: [{ id: "section-1", title: "Section réelle", status: "drafting" }],
  bookPlan: [],
  existingCuts: [],
  decisions: [],
  proposals: [
    {
      id: "proposal-1",
      status: "candidate" as const,
      contentCommitments: ["Conserver la tension"],
      formalCommitments: ["Ralentir le rythme"],
    },
  ],
  sources: [
    {
      sourceId: "source-qualified",
      title: "Archive qualifiée",
      authors: ["A. Auteur"],
      subjects: ["Mémoire"],
      concepts: [],
      qualified: true,
    },
    {
      sourceId: "source-unqualified",
      title: "Piste non qualifiée",
      authors: [],
      subjects: [],
      concepts: [],
      qualified: false,
    },
  ],
};

const reading = {
  id: "reading-1",
  fragment: { statement: "Un fragment situé.", claimIds: [], sourceIds: [] },
  pass1: { refraction: ["Le fragment déplace l’argument."] },
  pass2: { namedPatterns: [], revealedDefaults: [] },
  pass3: { entanglements: [] },
  pass4: { cut: "Conserver la tension", included: [], excluded: [], cutOfNonAdoption: [] },
  verdict: "integrate_now" as const,
  verdictDetail: "Le fragment soutient le plan.",
  action: "Conserver avec une transition.",
  tradeoffs: [],
  planImpacts: [],
  bibliographyImpacts: [],
  createdAt: "2026-08-26T12:00:00.000Z",
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/projects/project-1/atelier"]}>
      <Routes>
        <Route path="/projects/:projectId/atelier" element={<AuthorWorkshopPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AuthorWorkshopPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads a real section, exposes qualification, and renders a non-executable reading", async () => {
    fetchContext.mockResolvedValue(context);
    runReading.mockResolvedValue({ reading, executable: false });
    renderPage();

    fireEvent.change(screen.getByLabelText("ID de section"), { target: { value: "section-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Charger l’atelier" }));

    expect(await screen.findByRole("heading", { name: "Section réelle" })).toBeInTheDocument();
    expect(screen.getByText("Archive qualifiée")).toBeInTheDocument();
    expect(screen.getByText("Piste non qualifiée")).toBeInTheDocument();
    expect(screen.getByText("Piste non qualifiée").closest("li")).toHaveTextContent(
      "Non qualifiée"
    );

    fireEvent.change(screen.getByLabelText("Fragment à lire"), {
      target: { value: "Un fragment situé." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lire le fragment" }));

    expect(await screen.findByText("Intégrer maintenant")).toBeInTheDocument();
    expect(screen.getByText("Proposition non exécutable avant acte auteur")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Valider" })).toBeEnabled();
    await waitFor(() => {
      expect(runReading).toHaveBeenCalledWith("project-1", "section-1", {
        statement: "Un fragment situé.",
        articulationId: "proposal-1",
      });
    });
  });

  it("validates a candidate and refreshes the active decision and cut", async () => {
    fetchContext
      .mockResolvedValueOnce(context)
      .mockResolvedValueOnce({
        ...context,
        proposals: [],
        decisions: [{
          id: "decision-1",
          status: "active" as const,
          contentCommitments: ["Conserver la tension"],
          formalCommitments: ["Ralentir le rythme"],
          validation: { validatedBy: "author" as const, validatedAt: "2026-08-26T12:00:00.000Z" },
          supersedesDecisionId: "decision-prior",
        }],
        existingCuts: [{ scope: "section-1", verdict: "integrate_now", cut: "Conserver la tension" }],
      });
    runReading.mockResolvedValue({ reading, executable: false });
    acceptProposal.mockResolvedValue();
    renderPage();

    fireEvent.change(screen.getByLabelText("ID de section"), { target: { value: "section-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Charger l’atelier" }));
    await screen.findByRole("heading", { name: "Section réelle" });
    fireEvent.change(screen.getByLabelText("Fragment à lire"), { target: { value: "Un fragment situé." } });
    fireEvent.click(screen.getByRole("button", { name: "Lire le fragment" }));
    await screen.findByRole("button", { name: "Valider" });
    fireEvent.change(screen.getByLabelText("Note de validation (facultative)"), { target: { value: "Je valide cette coupe pour la section." } });
    fireEvent.click(screen.getByRole("button", { name: "Valider" }));

    expect(await screen.findByText("Décision validée et coupe active rafraîchie.")).toBeInTheDocument();
    expect(acceptProposal).toHaveBeenCalledWith("project-1", "proposal-1", {
      contentCommitments: ["Conserver la tension"],
      formalCommitments: ["Ralentir le rythme"],
      validationNote: "Je valide cette coupe pour la section.",
    });
    expect(screen.getAllByText("Conserver la tension")).toHaveLength(2);
    expect(screen.getByText("Supersède la décision decision-prior")).toBeInTheDocument();
  });

  it("requires a note before submitting an adaptation, then persists the adapted act", async () => {
    fetchContext.mockResolvedValue(context);
    runReading.mockResolvedValue({ reading, executable: false });
    modifyProposal.mockResolvedValue();
    renderPage();

    fireEvent.change(screen.getByLabelText("ID de section"), { target: { value: "section-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Charger l’atelier" }));
    await screen.findByRole("heading", { name: "Section réelle" });
    fireEvent.change(screen.getByLabelText("Fragment à lire"), { target: { value: "Un fragment situé." } });
    fireEvent.click(screen.getByRole("button", { name: "Lire le fragment" }));
    await screen.findByRole("button", { name: "Adapter" });
    fireEvent.click(screen.getByRole("button", { name: "Adapter" }));
    expect(screen.getByRole("button", { name: "Enregistrer l’adaptation" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Note d’adaptation"), { target: { value: "Je conserve la tension mais je ralentis la cadence." } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer l’adaptation" }));

    expect(await screen.findByText("Décision adaptée et coupe active rafraîchie.")).toBeInTheDocument();
    expect(modifyProposal).toHaveBeenCalledWith("project-1", "proposal-1", {
      contentCommitments: ["Conserver la tension"],
      formalCommitments: ["Ralentir le rythme"],
      validationNote: "Je conserve la tension mais je ralentis la cadence.",
    });
    expect(rejectProposal).not.toHaveBeenCalled();
  });

  it("archives a rejected candidate without presenting a new active cut", async () => {
    fetchContext.mockResolvedValue(context);
    runReading.mockResolvedValue({ reading, executable: false });
    rejectProposal.mockResolvedValue();
    renderPage();

    fireEvent.change(screen.getByLabelText("ID de section"), { target: { value: "section-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Charger l’atelier" }));
    await screen.findByRole("heading", { name: "Section réelle" });
    fireEvent.change(screen.getByLabelText("Fragment à lire"), { target: { value: "Un fragment situé." } });
    fireEvent.click(screen.getByRole("button", { name: "Lire le fragment" }));
    await screen.findByRole("button", { name: "Refuser" });
    fireEvent.click(screen.getByRole("button", { name: "Refuser" }));
    fireEvent.change(screen.getByLabelText("Note de refus (facultative)"), { target: { value: "Je garde cette piste en réserve." } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmer le refus" }));

    expect(await screen.findByText("Proposition refusée et archivée ; aucune coupe active n’a été créée.")).toBeInTheDocument();
    expect(rejectProposal).toHaveBeenCalledWith("project-1", "proposal-1", "Je garde cette piste en réserve.");
  });

  it("renders an error when the selected scope cannot be loaded", async () => {
    fetchContext.mockRejectedValue(new Error("HTTP 404"));
    renderPage();

    fireEvent.change(screen.getByLabelText("ID de section"), { target: { value: "missing" } });
    fireEvent.click(screen.getByRole("button", { name: "Charger l’atelier" }));

    expect(await screen.findByText("Contexte indisponible : HTTP 404")).toBeInTheDocument();
  });
});
