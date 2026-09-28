import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { PlanStructureEditor } from "./PlanStructureEditor";
import { applyPlanningStructuralDiff } from "@/api/planning";
vi.mock("@/api/planning", () => ({ applyPlanningStructuralDiff: vi.fn() }));
it("previews a structural move and only persists on explicit application", async () => {
  const apply = vi.mocked(applyPlanningStructuralDiff);
  apply.mockResolvedValue({ appliedChangeIds: ["change"] });
  const reload = vi.fn().mockResolvedValue(undefined);
  render(
    <PlanStructureEditor
      projectId="p"
      node={{
        kind: "node",
        id: "chapter",
        title: "Chapitre",
        children: [
          { kind: "node", id: "a", title: "Section A", children: [] },
          { kind: "node", id: "b", title: "Section B", children: [] },
        ],
      }}
      onApplied={reload}
    />,
  );
  fireEvent.change(screen.getByLabelText("Élément du plan"), {
    target: { value: "b" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Monter" }));
  expect(apply).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Appliquer le changement" }),
  );
  await waitFor(() =>
    expect(apply).toHaveBeenCalledWith("p", [
      expect.objectContaining({
        kind: "move_node",
        nodeId: "b",
        parentNodeId: "chapter",
        index: 0,
      }),
    ]),
  );
  expect(reload).toHaveBeenCalledOnce();
});
