import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AppShell } from "./AppShell";

function renderShell() {
  return render(
    <MemoryRouter initialEntries={["/projects/project-1/editor"]}>
      <AppShell projectId="project-1">
        <p>Manuscrit</p>
      </AppShell>
    </MemoryRouter>
  );
}

describe("AppShell", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the system theme first, then persists the author’s explicit choice", () => {
    renderShell();

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    fireEvent.click(screen.getByRole("button", { name: "Activer le thème sombre" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem("auto-essay.theme")).toBe("dark");

    renderShell();
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(screen.getAllByRole("button", { name: "Activer le thème clair" })).toHaveLength(2);
  });
});
