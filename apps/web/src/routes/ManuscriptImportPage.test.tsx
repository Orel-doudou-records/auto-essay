import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { confirmManuscriptImport, previewManuscriptImport } from "@/api";
import { ManuscriptImportPage } from "./ManuscriptImportPage";

vi.mock("@/api", () => ({
  previewManuscriptImport: vi.fn(),
  confirmManuscriptImport: vi.fn(),
}));

const previewImport = vi.mocked(previewManuscriptImport);
const confirmImport = vi.mocked(confirmManuscriptImport);

describe("ManuscriptImportPage", () => {
  it("lets the author correct a Markdown preview before confirming it", async () => {
    previewImport.mockResolvedValue({
      preview: {
        title: "Essai en cours",
        sections: [
          {
            id: "section-1",
            title: "Ouverture",
            content: "Texte initial.",
            level: 1,
            annotations: [{ kind: "link", label: "Repère", url: "https://example.test" }],
          },
        ],
      },
      warnings: [],
    });
    confirmImport.mockResolvedValue({
      manuscript: { id: "manuscript-1", projectId: "project-1", title: "Essai en cours" },
      units: [{ id: "unit-1" }],
    });
    const file = new File(["# Ouverture"], "essai.md", { type: "text/markdown" });
    Object.defineProperty(file, "text", { value: vi.fn().mockResolvedValue("# Ouverture") });

    render(
      <MemoryRouter initialEntries={["/projects/project-1/import"]}>
        <Routes>
          <Route path="/projects/:projectId/import" element={<ManuscriptImportPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText("Fichier Markdown, Word ou LibreOffice"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Préparer l’aperçu" }));

    expect(await screen.findByRole("heading", { name: "Aperçu à corriger" })).toBeInTheDocument();
    expect(previewImport).toHaveBeenCalledWith("project-1", "essai.md", "# Ouverture");

    fireEvent.change(screen.getByLabelText("Titre du manuscrit"), { target: { value: "" } });
    expect(screen.getByRole("button", { name: "Confirmer l’import" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Titre du manuscrit"), { target: { value: "Essai en cours" } });
    fireEvent.change(screen.getByLabelText("Titre de la section 1"), { target: { value: "Ouverture corrigée" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmer l’import" }));

    expect(confirmImport).toHaveBeenCalledWith("project-1", {
      title: "Essai en cours",
      sections: [
        expect.objectContaining({ title: "Ouverture corrigée", content: "Texte initial." }),
      ],
    });
    expect(await screen.findByText("Import terminé : 1 unité créée.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ouvrir la première section" })).toHaveAttribute(
      "href",
      "/projects/project-1/editor?unitId=unit-1"
    );
  });

  it("shows Word conversion warnings before the author confirms", async () => {
    previewImport.mockResolvedValue({
      preview: {
        title: "Essai en cours",
        sections: [{ id: "section-1", title: "Ouverture", content: "Texte.", level: 1, annotations: [] }],
      },
      warnings: ["Le style « Citation » a été simplifié."],
    });
    const content = new Uint8Array([80, 75, 3, 4]).buffer;
    const file = new File([content], "essai.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    Object.defineProperty(file, "arrayBuffer", { value: vi.fn().mockResolvedValue(content) });

    render(
      <MemoryRouter initialEntries={["/projects/project-1/import"]}>
        <Routes>
          <Route path="/projects/:projectId/import" element={<ManuscriptImportPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText("Fichier Markdown, Word ou LibreOffice"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Préparer l’aperçu" }));

    expect(await screen.findByRole("heading", { name: "Points à vérifier avant l’import" })).toBeInTheDocument();
    expect(screen.getByText("Le style « Citation » a été simplifié.")).toBeInTheDocument();
    expect(previewImport).toHaveBeenCalledWith("project-1", "essai.docx", content);
  });

  it("reads a LibreOffice document as binary input", async () => {
    previewImport.mockResolvedValue({
      preview: {
        title: "Essai ODT",
        sections: [{ id: "section-1", title: "Ouverture", content: "Texte.", level: 1, annotations: [] }],
      },
      warnings: [],
    });
    const content = new Uint8Array([80, 75, 3, 4]).buffer;
    const file = new File([content], "essai.odt", { type: "application/vnd.oasis.opendocument.text" });
    Object.defineProperty(file, "arrayBuffer", { value: vi.fn().mockResolvedValue(content) });

    render(
      <MemoryRouter initialEntries={["/projects/project-1/import"]}>
        <Routes>
          <Route path="/projects/:projectId/import" element={<ManuscriptImportPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText("Fichier Markdown, Word ou LibreOffice"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Préparer l’aperçu" }));

    expect(await screen.findByRole("heading", { name: "Aperçu à corriger" })).toBeInTheDocument();
    expect(previewImport).toHaveBeenCalledWith("project-1", "essai.odt", content);
  });
});
