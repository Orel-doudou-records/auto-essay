import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorWorkshopPage } from "./AuthorWorkshopPage";
import { fetchEditorialSectionContext, runEditorialSectionReading } from "@/api";

vi.mock("@/api", () => ({
  fetchEditorialSectionContext: vi.fn(),
  runEditorialSectionReading: vi.fn(),
}));

const fetchContext = vi.mocked(fetchEditorialSectionContext);
const runReading = vi.mocked(runEditorialSectionReading);

const context = {
  projectId: "project-1",
  section: { id: "section-1", title: "Section réelle" },
  bookParts: [{ id: "section-1", title: "Section réelle", status: "drafting" }],
  bookPlan: [],
  existingCuts: [],
  decisions: [],
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
    expect(screen.getByText("Proposition non exécutable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Valider (P1.4)" })).toBeDisabled();
    await waitFor(() => {
      expect(runReading).toHaveBeenCalledWith("project-1", "section-1", {
        statement: "Un fragment situé.",
      });
    });
  });

  it("renders an error when the selected scope cannot be loaded", async () => {
    fetchContext.mockRejectedValue(new Error("HTTP 404"));
    renderPage();

    fireEvent.change(screen.getByLabelText("ID de section"), { target: { value: "missing" } });
    fireEvent.click(screen.getByRole("button", { name: "Charger l’atelier" }));

    expect(await screen.findByText("Contexte indisponible : HTTP 404")).toBeInTheDocument();
  });
});
