import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmPlanImport, previewPlanImport, proposePlan } from "@/api";
import { PlanImportPage } from "./PlanImportPage";

vi.mock("@/api", () => ({ confirmPlanImport: vi.fn(), previewPlanImport: vi.fn(), proposePlan: vi.fn() }));

const previewPlan = vi.mocked(previewPlanImport);
const confirmPlan = vi.mocked(confirmPlanImport);
const propose = vi.mocked(proposePlan);

function NextProjectButton() {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate("/projects/project-2/plan-import?from=cadrage")}>Projet suivant</button>;
}

describe("PlanImportPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("shows a framing proposal as an editable preview and can discard it", async () => {
    propose.mockResolvedValue({
      preview: {
        title: "Essai en cours",
        sections: [{ id: "opening", title: "Ouverture", content: "Question centrale.", level: 1, annotations: [] }],
      },
      warnings: [],
    });
    render(
      <MemoryRouter initialEntries={["/projects/project-1/plan-import?from=cadrage"]}>
        <Routes><Route path="/projects/:projectId/plan-import" element={<PlanImportPage />} /></Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Aperçu à corriger" })).toBeInTheDocument();
    expect(propose).toHaveBeenCalledWith("project-1");
    fireEvent.click(screen.getByRole("button", { name: "Écarter la proposition" }));

    expect(screen.getByText("Proposition écartée")).toBeInTheDocument();
    expect(confirmPlan).not.toHaveBeenCalled();
  });

  it("confirms a framing proposal through the shared plan confirmation", async () => {
    propose.mockResolvedValue({
      preview: {
        title: "Essai en cours",
        sections: [{ id: "opening", title: "Ouverture", content: "Question centrale.", level: 1, annotations: [] }],
      },
      warnings: [],
    });
    confirmPlan.mockResolvedValue({ manuscript: { id: "plan-1", title: "Essai en cours", tree: [{ kind: "node", id: "opening" }] }, units: [] });
    render(
      <MemoryRouter initialEntries={["/projects/project-1/plan-import?from=cadrage"]}>
        <Routes><Route path="/projects/:projectId/plan-import" element={<PlanImportPage />} /></Routes>
      </MemoryRouter>
    );

    await screen.findByRole("heading", { name: "Aperçu à corriger" });
    fireEvent.click(screen.getByRole("button", { name: "Confirmer le plan" }));

    await vi.waitFor(() => expect(confirmPlan).toHaveBeenCalledWith("project-1", expect.objectContaining({ title: "Essai en cours" })));
    expect(await screen.findByText("Plan enregistré")).toBeInTheDocument();
  });

  it("reloads the proposal when the route changes project", async () => {
    propose
      .mockResolvedValueOnce({ preview: { title: "Projet 1", sections: [{ id: "one", title: "Un", content: "", level: 1, annotations: [] }], }, warnings: [] })
      .mockResolvedValueOnce({ preview: { title: "Projet 2", sections: [{ id: "two", title: "Deux", content: "", level: 1, annotations: [] }], }, warnings: [] });
    render(
      <MemoryRouter initialEntries={["/projects/project-1/plan-import?from=cadrage"]}>
        <NextProjectButton />
        <Routes><Route path="/projects/:projectId/plan-import" element={<PlanImportPage />} /></Routes>
      </MemoryRouter>
    );

    await screen.findByDisplayValue("Projet 1");
    fireEvent.click(screen.getByRole("button", { name: "Projet suivant" }));

    expect(await screen.findByDisplayValue("Projet 2")).toBeInTheDocument();
    expect(propose).toHaveBeenLastCalledWith("project-2");
  });

  it("lets the author correct a plan preview before confirmation without creating writing", async () => {
    previewPlan.mockResolvedValue({
      preview: {
        title: "Plan initial",
        sections: [{ id: "opening", title: "Ouverture", content: "Question centrale.", level: 1, annotations: [] }],
      },
      warnings: [],
    });
    confirmPlan.mockResolvedValue({ manuscript: { id: "plan-1", title: "Plan initial", tree: [{ kind: "node", id: "opening" }] }, units: [] });
    render(
      <MemoryRouter initialEntries={["/projects/project-1/plan-import"]}>
        <Routes><Route path="/projects/:projectId/plan-import" element={<PlanImportPage />} /></Routes>
      </MemoryRouter>
    );

    const file = new File(["# Ouverture\n\nQuestion centrale."], "plan.md", { type: "text/markdown" });
    fireEvent.change(screen.getByLabelText("Fichier Markdown, Word ou LibreOffice"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Préparer l’aperçu" }));

    expect(await screen.findByRole("heading", { name: "Aperçu à corriger" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "Ouverture corrigée" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmer le plan" }));

    await vi.waitFor(() => expect(confirmPlan).toHaveBeenCalledWith(
      "project-1",
      expect.objectContaining({ sections: [expect.objectContaining({ title: "Ouverture corrigée" })] })
    ));
    expect(await screen.findByText("Plan enregistré")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ouvrir le plan" })).toHaveAttribute(
      "href",
      "/projects/project-1/chapitre?chapterId=opening"
    );
  });

  it("lets the author cancel a preview without confirming it", async () => {
    previewPlan.mockResolvedValue({
      preview: {
        title: "Plan initial",
        sections: [{ id: "opening", title: "Ouverture", content: "Question centrale.", level: 1, annotations: [] }],
      },
      warnings: [],
    });
    render(
      <MemoryRouter initialEntries={["/projects/project-1/plan-import"]}>
        <Routes><Route path="/projects/:projectId/plan-import" element={<PlanImportPage />} /></Routes>
      </MemoryRouter>
    );

    const file = new File(["# Ouverture"], "plan.md", { type: "text/markdown" });
    fireEvent.change(screen.getByLabelText("Fichier Markdown, Word ou LibreOffice"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Préparer l’aperçu" }));
    await screen.findByRole("button", { name: "Annuler l’aperçu" });
    fireEvent.click(screen.getByRole("button", { name: "Annuler l’aperçu" }));

    expect(screen.getByRole("button", { name: "Préparer l’aperçu" })).toBeInTheDocument();
    expect(confirmPlan).not.toHaveBeenCalled();
  });
});
