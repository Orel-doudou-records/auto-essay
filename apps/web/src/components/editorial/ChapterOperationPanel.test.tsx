import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  awaitChapterOperationAuthor,
  cancelChapterOperation,
  createChapterOperation,
  generateUnit,
  startChapterOperation,
  type ChapterOperationPayload,
} from "@/api";
import { ChapterOperationPanel } from "./ChapterOperationPanel";

vi.mock("@/api", () => ({
  createChapterOperation: vi.fn(),
  awaitChapterOperationAuthor: vi.fn(),
  startChapterOperation: vi.fn(),
  cancelChapterOperation: vi.fn(),
  generateUnit: vi.fn(),
}));

const createOperation = vi.mocked(createChapterOperation);
const awaitAuthor = vi.mocked(awaitChapterOperationAuthor);
const startOperation = vi.mocked(startChapterOperation);
const cancelOperation = vi.mocked(cancelChapterOperation);
const generateDraftUnit = vi.mocked(generateUnit);

const preparing: ChapterOperationPayload = {
  id: "operation-1",
  state: "preparing" as const,
  provenance: { projectId: "project-1", chapterId: "chapter-1", requestedBy: "author" as const },
  trace: [{ type: "created", actor: "author", occurredAt: "2026-08-27T11:00:00.000Z" }],
};

describe("ChapterOperationPanel", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders explicit operation acts without starting generation", async () => {
    createOperation.mockResolvedValue({ operation: preparing, executed: false });
    awaitAuthor.mockResolvedValue({
      operation: { ...preparing, state: "awaiting_author" as const },
      executed: false,
    });
    startOperation.mockResolvedValue({
      operation: { ...preparing, state: "running" as const },
      executed: false,
    });
    cancelOperation.mockResolvedValue({
      operation: { ...preparing, state: "cancelled" as const },
      executed: false,
    });

    render(<ChapterOperationPanel projectId="project-1" chapterId="chapter-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Déclarer une opération de chapitre" }));
    expect(await screen.findByText("Préparation déclarée : aucun travail automatique n’est lancé.")).toBeInTheDocument();
    expect(createOperation).toHaveBeenCalledWith("project-1", "chapter-1");

    fireEvent.click(screen.getByRole("button", { name: "Marquer prête à recevoir l’acte auteur" }));
    expect(await screen.findByText("En attente de l’acte auteur")).toBeInTheDocument();
    expect(awaitAuthor).toHaveBeenCalledWith("project-1", "operation-1");

    fireEvent.click(screen.getByRole("button", { name: "Démarrer l’opération (acte auteur)" }));
    expect(await screen.findByText("Exécution déclarée")).toBeInTheDocument();
    expect(startOperation).toHaveBeenCalledWith("project-1", "operation-1");

    fireEvent.click(screen.getByRole("button", { name: "Annuler l’opération" }));
    expect(await screen.findByText("Annulée")).toBeInTheDocument();
    expect(cancelOperation).toHaveBeenCalledWith("project-1", "operation-1");
    expect(generateDraftUnit).not.toHaveBeenCalled();
  });
});
