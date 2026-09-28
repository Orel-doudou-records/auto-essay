import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSource } from "@auto-essay/core";
import { useSources } from "@/hooks/useSources";
import { SourcesPage } from "./SourcesPage";
vi.mock("@/hooks/useSources", () => ({ useSources: vi.fn() }));
vi.mock("@/hooks/useUnits", () => ({ useUnits: () => ({ units: [] }) }));
vi.mock("@/hooks/useSourceOverview", () => ({
  sourceStateLabels: {
    explored: "Explorée",
    registered_unexplored: "Non explorée",
  },
  useSourceOverview: () => ({
    sources: [
      {
        id: "a",
        state: "explored",
        nodeLinks: [{ id: "chapter", title: "Chapitre lié" }],
      },
      { id: "b", state: "registered_unexplored" },
    ],
  }),
}));
vi.mock("@/components/workspace/ProjectWorkspace", async () => {
  const original = await vi.importActual<
    typeof import("@/components/workspace/ProjectWorkspace")
  >("@/components/workspace/ProjectWorkspace");
  return {
    ...original,
    ProjectWorkspace: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
  };
});
const update = vi.fn();
const importFiles = vi.fn();
const sources = [
  createSource({ projectId: "p", title: "Archive locale", content: "Texte" }),
  createSource({
    projectId: "p",
    title: "Notice bibliographique",
    content: "",
  }),
].map((source, index) => ({ ...source, id: index ? "b" : "a" }));
function renderPage() {
  render(
    <MemoryRouter initialEntries={["/projects/p/sources"]}>
      <Routes>
        <Route path="/projects/:projectId/sources" element={<SourcesPage />} />
      </Routes>
    </MemoryRouter>,
  );
}
describe("SourcesPage journeys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSources).mockReturnValue({
      sources,
      loading: false,
      error: null,
      reload: vi.fn(),
      importFiles,
      update,
      remove: vi.fn(),
    });
  });
  it("filters actual statuses and keeps note edits explicit", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Non explorées (1)" }));
    expect(
      screen.queryByRole("button", { name: /Archive locale/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Notice bibliographique/ }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Notes" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nouvelle note" }), {
      target: { value: "À approfondir" },
    });
    expect(update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une note" }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        "b",
        expect.objectContaining({
          annotations: [
            expect.objectContaining({
              content: "À approfondir",
              sourceId: "b",
            }),
          ],
        }),
      ),
    );
  });
  it("reports partial import errors instead of silently claiming success", async () => {
    importFiles.mockResolvedValue({
      imported: 0,
      errors: [{ file: "broken.bib", message: "Entrée invalide" }],
    });
    renderPage();
    const file = new File(["broken"], "broken.bib", { type: "text/plain" });
    Object.defineProperty(file, "text", { value: async () => "broken" });
    fireEvent.change(screen.getByLabelText("Importer des sources"), {
      target: { files: [file] },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Entrée invalide",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "0 source(s) importée(s)",
    );
  });
  it("opens the chapter whose active framing references the source", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Liens" }));
    expect(
      screen.getByRole("link", { name: "Chapitre lié · Cadrage" }),
    ).toHaveAttribute("href", "/projects/p/chapitre?chapterId=chapter");
  });
});
