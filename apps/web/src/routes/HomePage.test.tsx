import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { HomePage } from "@/routes/HomePage";

const mockProjects: Array<{ id: string; title: string; updatedAt: string }> = [];

vi.mock("@/api", () => ({
  fetchProjects: vi.fn(async () => mockProjects),
  createProject: vi.fn(async (title: string) => ({
    id: "1",
    title,
    updatedAt: new Date().toISOString(),
  })),
  deleteProject: vi.fn(async () => undefined),
}));

describe("HomePage", () => {
  beforeEach(() => {
    mockProjects.length = 0;
  });

  it("renders empty state and creates a project", async () => {
    render(
      <BrowserRouter>
        <HomePage />
      </BrowserRouter>
    );

    expect(screen.getByRole("heading", { name: "Projets" })).toBeInTheDocument();

    const input = screen.getByPlaceholderText("Titre du nouvel essai");
    fireEvent.change(input, { target: { value: "Mon essai" } });
    fireEvent.click(screen.getByText("Nouveau"));

    await waitFor(() => {
      expect(screen.getByText("Mon essai")).toBeInTheDocument();
    });
  });
});
