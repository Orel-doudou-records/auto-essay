import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { ProjectWorkspace } from "./ProjectWorkspace";
vi.mock("@/hooks/useUnits", () => ({ useUnits: () => ({ units: [] }) }));
vi.mock("@/hooks/useManuscriptNavigation", () => ({
  useManuscriptNavigation: () => ({ entries: [], reload: vi.fn() }),
}));
vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("./ProjectNavigation", () => ({
  findScopePath: () => [],
  ProjectNavigation: () => null,
  ProjectAssets: () => null,
}));
vi.mock("./ContextInspector", () => ({
  ContextInspector: () => <p>Contexte sélectionné</p>,
}));
it("keeps desktop panels visible by default and lets the author collapse them independently", () => {
  render(
    <MemoryRouter>
      <ProjectWorkspace projectId="p">
        <h1>Vue principale</h1>
      </ProjectWorkspace>
    </MemoryRouter>,
  );
  expect(
    screen.getByRole("navigation", { name: "Structure du manuscrit" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("complementary", { name: "Inspecteur éditorial" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Manuscrit" }));
  expect(
    screen.queryByRole("navigation", { name: "Structure du manuscrit" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("complementary", { name: "Inspecteur éditorial" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Agent et contexte" }));
  expect(
    screen.queryByRole("complementary", { name: "Inspecteur éditorial" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Manuscrit" }));
  expect(
    screen.getByRole("navigation", { name: "Structure du manuscrit" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Vue principale" }),
  ).toBeInTheDocument();
});
