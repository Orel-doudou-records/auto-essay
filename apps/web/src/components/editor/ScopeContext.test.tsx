import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchScopeContext,
  setScopeContextSourceIncluded,
  type ScopeContext as ScopeContextData,
} from "@/api/scopeContext";
import { ScopeContext } from "./ScopeContext";

vi.mock("@/api/scopeContext", () => ({
  fetchScopeContext: vi.fn(),
  setScopeContextSourceIncluded: vi.fn(),
}));

const fetchContext = vi.mocked(fetchScopeContext);
const setSourceIncluded = vi.mocked(setScopeContextSourceIncluded);

function context(
  scopeId: string,
  input: Partial<ScopeContextData> = {}
): ScopeContextData {
  return {
    scope: { kind: "node", id: scopeId },
    text: `Texte ${scopeId}`,
    planning: null,
    decisions: [],
    sources: [],
    passages: [],
    exploration: {
      complete: false,
      status: "empty_library",
      gaps: [],
      underDocumentedHypotheses: [],
    },
    sourceSelection: { editable: true, authority: "planning_brief" },
    ...input,
  };
}

describe("ScopeContext", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("reloads the displayed context when the active scope changes without leaking sources or decisions", async () => {
    fetchContext.mockImplementation(async (_projectId, scope) => {
      if (scope.id === "scope-a") {
        return context("scope-a", {
          planning: {
            id: "brief-a",
            version: 1,
            question: "Question A ?",
            constraints: [],
          },
          decisions: [{
            id: "decision-a",
            contentCommitments: ["Décision A"],
            formalCommitments: [],
            invariants: [],
            prohibitedShortcuts: [],
            validatedAt: "2026-09-14T10:00:00.000Z",
          }],
          sources: [{
            id: "source-a",
            title: "Source A",
            authors: [],
            included: false,
            state: "partial",
            subjects: [],
            concepts: [],
            coverage: { coveredBlocks: 1, totalBlocks: 2 },
          }],
          exploration: {
            complete: false,
            status: "incomplete",
            gaps: [{ description: "Manque A", consequence: "Fragilise A" }],
            underDocumentedHypotheses: [],
          },
        });
      }
      return context("scope-b", {
        sources: [{
          id: "source-b",
          title: "Source B",
          authors: [],
          included: false,
          state: "explored",
          subjects: [],
          concepts: [],
          coverage: { coveredBlocks: 2, totalBlocks: 2 },
        }],
        exploration: {
          complete: true,
          status: "no_result",
          gaps: [],
          underDocumentedHypotheses: [],
        },
      });
    });

    const { rerender } = render(
      <ScopeContext projectId="project-1" scope={{ kind: "node", id: "scope-a" }} />
    );
    expect(await screen.findByText("Question A ?")).toBeInTheDocument();
    expect(screen.getByText("Source A")).toBeInTheDocument();
    expect(screen.getByLabelText("État documentaire : Partielle")).toBeInTheDocument();
    expect(screen.getByText("Décision A")).toBeInTheDocument();
    expect(screen.getByText(/pas encore suffisamment exploré/)).toBeInTheDocument();

    rerender(<ScopeContext projectId="project-1" scope={{ kind: "node", id: "scope-b" }} />);
    expect(await screen.findByText("Source B")).toBeInTheDocument();
    expect(screen.getByLabelText("État documentaire : Explorée")).toBeInTheDocument();
    expect(screen.getByText("Aucun résultat trouvé dans le corpus actuellement exploré.")).toBeInTheDocument();
    expect(screen.queryByText("Source A")).not.toBeInTheDocument();
    expect(screen.queryByText("Décision A")).not.toBeInTheDocument();
    expect(fetchContext).toHaveBeenNthCalledWith(1, "project-1", { kind: "node", id: "scope-a" });
    expect(fetchContext).toHaveBeenNthCalledWith(2, "project-1", { kind: "node", id: "scope-b" });
  });

  it("updates source inclusion through the scope authority instead of the project library", async () => {
    const initial = context("unit-1", {
      scope: { kind: "unit", id: "unit-1" },
      sources: [{
        id: "source-1",
        title: "Source ciblée",
        authors: [],
        included: true,
        state: "registered_unexplored",
        subjects: [],
        concepts: [],
        coverage: null,
      }],
      exploration: {
        complete: false,
        status: "has_context",
        gaps: [],
        underDocumentedHypotheses: [],
      },
      sourceSelection: { editable: true, authority: "evidence_pack" },
    });
    const updated = {
      ...initial,
      sources: initial.sources.map((source) => ({ ...source, included: false })),
      exploration: { ...initial.exploration, status: "incomplete" as const },
    };
    fetchContext.mockResolvedValue(initial);
    setSourceIncluded.mockResolvedValue(updated);

    render(<ScopeContext projectId="project-1" scope={{ kind: "unit", id: "unit-1" }} />);
    await screen.findByText("Source ciblée");
    fireEvent.click(screen.getByRole("button", { name: "Exclure Source ciblée du contexte" }));

    await vi.waitFor(() => expect(setSourceIncluded).toHaveBeenCalledWith(
      "project-1",
      { kind: "unit", id: "unit-1" },
      "source-1",
      false
    ));
    expect(await screen.findByRole("button", { name: "Ajouter Source ciblée au contexte" })).toBeInTheDocument();
    expect(screen.getByLabelText("État documentaire : Enregistrée · non explorée")).toBeInTheDocument();
  });
});
