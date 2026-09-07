import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmPlanImport, previewPlanImport } from "@/api";
import { PlanImportPage } from "./PlanImportPage";

vi.mock("@/api", () => ({ confirmPlanImport: vi.fn(), previewPlanImport: vi.fn() }));

const previewPlan = vi.mocked(previewPlanImport);
const confirmPlan = vi.mocked(confirmPlanImport);

describe("PlanImportPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
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
