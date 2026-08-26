import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchChapterEditorialWorkspace, generateUnit } from "@/api";
import { ChapterWorkshopPage } from "./ChapterWorkshopPage";

vi.mock("@/api", () => ({
  fetchChapterEditorialWorkspace: vi.fn(),
  generateUnit: vi.fn(),
}));

const fetchChapter = vi.mocked(fetchChapterEditorialWorkspace);
const generateDraftUnit = vi.mocked(generateUnit);

const workspace = {
  chapter: { id: "chapter-1", title: "Chapitre premier", writingStatus: "drafting" },
  sections: [
    {
      id: "section-1",
      title: "Première section",
      order: 1,
      writingStatus: "verified",
      decisions: [{ id: "decision-1", contentCommitments: ["Conserver la tension"] }],
      units: [
        {
          id: "unit-prepared",
          status: "drafting",
          contentLength: 0,
          preparedForWriting: true,
          provenance: { association: "section_context" as const },
        },
      ],
      sources: [
        {
          sourceId: "source-qualified",
          title: "Archive qualifiée",
          qualified: true,
          availability: "evidence_pack" as const,
          provenance: { distributionScopeId: "section-1" },
        },
        {
          sourceId: "source-visible",
          title: "Piste visible",
          qualified: false,
          availability: "visible_only" as const,
          exclusionReason: "missing_excerpt" as const,
          provenance: { distributionScopeId: "section-1" },
        },
      ],
      readiness: "has_active_decision" as const,
      transitions: {
        workshop: {
          sectionId: "section-1",
          href: "/projects/project-1/atelier?sectionId=section-1",
        },
        preparedUnits: [
          {
            unitId: "unit-prepared",
            href: "/projects/project-1/editor?unitId=unit-prepared",
          },
        ],
      },
    },
    {
      id: "section-2",
      title: "Seconde section",
      order: 2,
      writingStatus: "drafting",
      decisions: [],
      units: [],
      sources: [],
      readiness: "needs_active_decision" as const,
      transitions: {
        workshop: {
          sectionId: "section-2",
          href: "/projects/project-1/atelier?sectionId=section-2",
        },
        preparedUnits: [],
      },
    },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/projects/project-1/chapitre"]}>
      <Routes>
        <Route path="/projects/:projectId/chapitre" element={<ChapterWorkshopPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ChapterWorkshopPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders ordered chapter state and explicit navigation without generation", async () => {
    fetchChapter.mockResolvedValue(workspace);
    renderPage();

    fireEvent.change(screen.getByLabelText("ID du chapitre"), { target: { value: "chapter-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Charger le chapitre" }));

    expect(await screen.findByRole("heading", { name: "Chapitre premier" })).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent)
        .filter((title): title is string => Boolean(title?.match(/^\d+\./)))
    ).toEqual(["1. Première section", "2. Seconde section"]);
    expect(screen.getByText("1 décision active")).toBeInTheDocument();
    expect(screen.getByText("Archive qualifiée").closest("li")).toHaveTextContent("Preuve qualifiée");
    expect(screen.getByText("Piste visible").closest("li")).toHaveTextContent("Visible, non retenue");
    expect(screen.getByText("Aucune décision active : préparation non disponible.")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Ouvrir l’atelier de section" })[0]).toHaveAttribute(
      "href",
      "/projects/project-1/atelier?sectionId=section-1"
    );
    expect(screen.getByRole("link", { name: "Ouvrir l’unité préparée" })).toHaveAttribute(
      "href",
      "/projects/project-1/editor?unitId=unit-prepared"
    );
    expect(fetchChapter).toHaveBeenCalledWith("project-1", "chapter-1");
    expect(generateDraftUnit).not.toHaveBeenCalled();
  });

  it("renders the empty chapter state and scope errors", async () => {
    fetchChapter
      .mockResolvedValueOnce({ chapter: { id: "empty", title: "Chapitre vide", writingStatus: "drafting" }, sections: [] })
      .mockRejectedValueOnce(new Error("HTTP 404"));
    renderPage();

    fireEvent.change(screen.getByLabelText("ID du chapitre"), { target: { value: "empty" } });
    fireEvent.click(screen.getByRole("button", { name: "Charger le chapitre" }));
    expect(await screen.findByText("Ce chapitre ne contient encore aucune section.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("ID du chapitre"), { target: { value: "missing" } });
    fireEvent.click(screen.getByRole("button", { name: "Charger le chapitre" }));
    expect(await screen.findByText("Erreur : HTTP 404")).toBeInTheDocument();
  });
});
