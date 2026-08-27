import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { WorkspaceLandingPage } from "./WorkspaceLandingPage";

describe("WorkspaceLandingPage", () => {
  it("présente le parcours de travail et les garanties d’autorité à partir d’une seule page", () => {
    render(
      <MemoryRouter>
        <WorkspaceLandingPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Écrire un essai sans céder la décision." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Le parcours de travail" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "L’auteur garde le dernier mot" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ouvrir mes projets" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Explorer la démo" })).toHaveAttribute("href", "/demo");

    expect(screen.getByText("Manuscrit")).toBeInTheDocument();
    expect(screen.getByText("Sources et preuves")).toBeInTheDocument();
    expect(screen.getByText("Lecture diffractive")).toBeInTheDocument();
    expect(screen.getByText("Révision explicite")).toBeInTheDocument();
    expect(screen.getByText("Évaluation située")).toBeInTheDocument();
  });
});
