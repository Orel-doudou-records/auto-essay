import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { DemoPage } from "@/routes/DemoPage";

const mockContext = {
  id: "judeofuturisme",
  title: "Judéofuturisme : mémoire, technique et rédemption",
  chapter: { id: "chap-2", title: "Chapitre 2 - Le salon" },
  context: {
    bookParts: [],
    bookPlan: [],
    concepts: [],
    tensions: [],
    bookBibliography: {
      entries: [{ sourceId: "eshun2003", title: "Further Considerations on Afrofuturism" }],
    },
  },
  sourcesCount: 1,
  suggestedFragments: [
    {
      label: "chap2-14/16 — le salon dans la cabine",
      statement: "Le vaisseau est un salon.",
    },
  ],
};

const mockReading = {
  fragment: { statement: "Le vaisseau est un salon.", claimIds: [], sourceIds: [] },
  pass1: { refraction: ["Le vaisseau-salon comme machine à différer."] },
  pass2: { namedPatterns: ["l'exil comme système technique"], revealedDefaults: [] },
  pass3: { entanglements: [] },
  pass4: {
    cut: "Le vaisseau-salon comme modèle de diaspora technique",
    included: ["la cabine comme métaphore"],
    excluded: [],
    cutOfNonAdoption: [],
  },
  verdict: "integrate_now",
  verdictDetail: "Intègre maintenant.",
  action: "a",
  tradeoffs: [],
  planImpacts: [{ partId: "chap-2", partTitle: "Le salon", entryId: "chap2-15", impact: "Conclusion." }],
  bibliographyImpacts: [
    { sourceId: "eshun2003", scopeId: "chap-2", kind: "rapprocher", impact: "Rapprocher." },
  ],
};

vi.mock("@/api", () => ({
  fetchDemoContext: vi.fn(async () => mockContext),
  runDiffractReading: vi.fn(async () => mockReading),
}));

describe("DemoPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the projected documentary context and runs a suggested fragment", async () => {
    render(
      <BrowserRouter>
        <DemoPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Chapitre 2 - Le salon/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Bibliothèque projetée : 1 sources/)).toBeInTheDocument();
    expect(screen.queryByText(/Signaux du graphe/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("chap2-14/16 — le salon dans la cabine"));

    await waitFor(() => {
      expect(screen.getByText("Intégrer maintenant")).toBeInTheDocument();
    });
    expect(
      screen.getByText("Pass 4 — la coupe agentielle")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/le vaisseau-salon comme machine à différer/i)
    ).toBeInTheDocument();
    expect(screen.getByText("Impacts bibliographiques")).toBeInTheDocument();
    expect(screen.getByText("rapprocher")).toBeInTheDocument();
  });
});
