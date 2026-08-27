import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorWorkshopPage } from "./AuthorWorkshopPage";
import {
  acceptEditorialProposal,
  createEditorialWritingDraftUnit,
  fetchEditorialSectionContext,
  fetchEditorialWritingContext,
  generateUnit,
  modifyEditorialProposal,
  rejectEditorialProposal,
  runEditorialParagraphReading,
  runEditorialSectionReading,
  runEditorialSectionScopeReading,
} from "@/api";

vi.mock("@/api", () => ({
  fetchEditorialSectionContext: vi.fn(),
  fetchEditorialWritingContext: vi.fn(),
  createEditorialWritingDraftUnit: vi.fn(),
  generateUnit: vi.fn(),
  runEditorialSectionReading: vi.fn(),
  runEditorialSectionScopeReading: vi.fn(),
  runEditorialParagraphReading: vi.fn(),
  acceptEditorialProposal: vi.fn(),
  modifyEditorialProposal: vi.fn(),
  rejectEditorialProposal: vi.fn(),
}));

const fetchContext = vi.mocked(fetchEditorialSectionContext);
const fetchWritingContext = vi.mocked(fetchEditorialWritingContext);
const createWritingDraftUnit = vi.mocked(createEditorialWritingDraftUnit);
const generateDraftUnit = vi.mocked(generateUnit);
const runReading = vi.mocked(runEditorialSectionReading);
const runSectionScopeReading = vi.mocked(runEditorialSectionScopeReading);
const runParagraphReading = vi.mocked(runEditorialParagraphReading);
const acceptProposal = vi.mocked(acceptEditorialProposal);
const modifyProposal = vi.mocked(modifyEditorialProposal);
const rejectProposal = vi.mocked(rejectEditorialProposal);

const context = {
  projectId: "project-1",
  section: { id: "section-1", title: "Section réelle" },
  diffraction: {
    mode: "strict" as const,
    paragraphs: [
      {
        id: "paragraph-1",
        version: 2,
        content: "Un paragraphe réel de la section.",
      },
    ],
  },
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
    runReading.mockResolvedValue({
      reading,
      executable: false,
      scope: { kind: "fragment", sectionId: "section-1" },
      provenance: { triggeredBy: "author" },
    });
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

  it("lets the author explicitly read a section or one of its paragraphs in strict mode", async () => {
    fetchContext.mockResolvedValue(context);
    runSectionScopeReading.mockResolvedValue({
      reading,
      executable: false,
      scope: { kind: "section", sectionId: "section-1" },
      provenance: { triggeredBy: "author" },
    });
    runParagraphReading.mockResolvedValue({
      reading,
      executable: false,
      scope: {
        kind: "paragraph",
        sectionId: "section-1",
        unitId: "paragraph-1",
        unitVersion: 2,
      },
      provenance: { triggeredBy: "author" },
    });
    renderPage();

    fireEvent.change(screen.getByLabelText("ID de section"), { target: { value: "section-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Charger l’atelier" }));
    await screen.findByRole("heading", { name: "Section réelle" });

    expect(runSectionScopeReading).not.toHaveBeenCalled();
    expect(runParagraphReading).not.toHaveBeenCalled();
    expect(generateDraftUnit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Lire la section" }));
    await waitFor(() => {
      expect(runSectionScopeReading).toHaveBeenCalledWith("project-1", "section-1", {});
    });
    expect(await screen.findByText("Lecture de section")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Lire le paragraphe paragraph-1" }));
    await waitFor(() => {
      expect(runParagraphReading).toHaveBeenCalledWith(
        "project-1",
        "section-1",
        "paragraph-1",
        {}
      );
    });
    expect(await screen.findByText("Lecture de paragraphe — paragraph-1, version 2")).toBeInTheDocument();
    expect(acceptProposal).not.toHaveBeenCalled();
    expect(modifyProposal).not.toHaveBeenCalled();
    expect(rejectProposal).not.toHaveBeenCalled();
  });

  it("prepares an active decision into a traceable empty draft unit without generation", async () => {
    const activeContext = {
      ...context,
      decisions: [{
        id: "decision-1",
        status: "active" as const,
        contentCommitments: ["Conserver la tension"],
        formalCommitments: ["Ralentir le rythme"],
        validation: { validatedBy: "author" as const, validatedAt: "2026-08-26T12:00:00.000Z" },
      }],
    };
    fetchContext.mockResolvedValue(activeContext);
    fetchWritingContext.mockResolvedValue({
      sectionId: "section-1",
      decision: activeContext.decisions[0],
      evidencePack: {
        sourceIds: ["source-qualified"],
        keyCitations: [{ sourceId: "source-qualified", quote: "Extrait traçable", context: "source distribuée" }],
        supportingClaimIds: [],
        objections: [],
      },
      visibleSources: [
        {
          sourceId: "source-qualified",
          title: "Archive qualifiée",
          qualified: true,
          inclusion: "evidence_pack" as const,
          excerpt: "Extrait traçable",
          provenance: { distributionRationale: "source distribuée", distributionConfidence: 0.9 },
        },
        {
          sourceId: "source-unqualified",
          title: "Piste non qualifiée",
          qualified: false,
          inclusion: "visible_only" as const,
          exclusionReason: "missing_or_unqualified_profile" as const,
          provenance: { distributionRationale: "piste distribuée", distributionConfidence: 0.5 },
        },
      ],
    });
    createWritingDraftUnit.mockResolvedValue({
      unit: { id: "unit-1", content: "", targetWordCount: 200 },
      generated: false,
    });
    renderPage();

    fireEvent.change(screen.getByLabelText("ID de section"), { target: { value: "section-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Charger l’atelier" }));
    await screen.findByRole("heading", { name: "Section réelle" });
    fireEvent.click(screen.getByRole("button", { name: "Préparer le contexte de rédaction" }));

    expect(await screen.findByText("Contexte de rédaction préparé : aucune génération n’a été lancée.")).toBeInTheDocument();
    expect(screen.getAllByText("Archive qualifiée").at(0)?.closest("li")).toHaveTextContent("Preuve retenue");
    expect(screen.getAllByText("Piste non qualifiée").at(0)?.closest("li")).toHaveTextContent("Visible, non retenue");
    fireEvent.click(screen.getByRole("button", { name: "Créer une unité de rédaction vide" }));

    expect(await screen.findByText("Unité unit-1 créée, avec un contenu vide.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ouvrir l’unité préparée" })).toHaveAttribute(
      "href",
      "/projects/project-1/editor?unitId=unit-1"
    );
    expect(fetchWritingContext).toHaveBeenCalledWith("project-1", "section-1", "decision-1");
    expect(createWritingDraftUnit).toHaveBeenCalledWith("project-1", "section-1", {
      decisionId: "decision-1",
    });
    expect(generateDraftUnit).not.toHaveBeenCalled();
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
    runReading.mockResolvedValue({
      reading,
      executable: false,
      scope: { kind: "fragment", sectionId: "section-1" },
      provenance: { triggeredBy: "author" },
    });
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
    runReading.mockResolvedValue({
      reading,
      executable: false,
      scope: { kind: "fragment", sectionId: "section-1" },
      provenance: { triggeredBy: "author" },
    });
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
    runReading.mockResolvedValue({
      reading,
      executable: false,
      scope: { kind: "fragment", sectionId: "section-1" },
      provenance: { triggeredBy: "author" },
    });
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
