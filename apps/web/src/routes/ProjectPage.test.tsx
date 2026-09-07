import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProject } from "@/hooks/useProject";
import { ProjectPage } from "./ProjectPage";

vi.mock("@/hooks/useProject", () => ({ useProject: vi.fn() }));

const project = {
  id: "project-1",
  title: "Essai en cours",
  thesisSeed: "Une amorce",
  contextScope: "Un périmètre",
  claims: [],
  sourceIds: [],
  conceptIds: [],
  tensionIds: [],
  draftUnitIds: [],
  createdAt: "2026-09-06T00:00:00.000Z",
  updatedAt: "2026-09-06T00:00:00.000Z",
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/projects/project-1/cadrage"]}>
      <Routes>
        <Route path="/projects/:projectId/cadrage" element={<ProjectPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ProjectPage", () => {
  const update = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useProject).mockReturnValue({
      project,
      loading: false,
      error: null,
      reload: vi.fn(),
      update,
    });
  });

  it("confirms that the framing was saved", async () => {
    update.mockResolvedValue(project);
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(screen.getByRole("button", { name: "Enregistrement…" })).toBeDisabled();
    expect(await screen.findByText("Cadrage enregistré.")).toBeInTheDocument();
    expect(update).toHaveBeenCalledWith({ title: "Essai en cours", thesisSeed: "Une amorce" });
  });

  it("offers a plan proposal from the framing", () => {
    renderPage();

    expect(screen.getByRole("link", { name: "Proposer un plan" })).toHaveAttribute(
      "href",
      "/projects/project-1/plan-import?from=cadrage"
    );
  });

  it("explains when saving fails", async () => {
    update.mockRejectedValue(new Error("offline"));
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("L’enregistrement a échoué. Réessayez.");
    });
  });
});
