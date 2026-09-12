import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DraftUnit } from "@auto-essay/core";
import { useUnits } from "@/hooks/useUnits";
import { useManuscriptNavigation } from "@/hooks/useManuscriptNavigation";
import {
  acceptCollaborativeRevisionWork,
  rejectCollaborativeRevisionWork,
  type RevisionSuggestionPayload,
} from "@/api/revisionWork";
import { EditorPage } from "./EditorPage";

vi.mock("@/hooks/useUnits", () => ({ useUnits: vi.fn() }));
vi.mock("@/hooks/useManuscriptNavigation", () => ({ useManuscriptNavigation: vi.fn() }));
vi.mock("@/api", () => ({ exportProject: vi.fn() }));
vi.mock("@/api/revisionWork", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/revisionWork")>();
  return {
    ...actual,
    acceptCollaborativeRevisionWork: vi.fn(),
    rejectCollaborativeRevisionWork: vi.fn(),
  };
});

const useProjectUnits = vi.mocked(useUnits);
const useProjectNavigation = vi.mocked(useManuscriptNavigation);
const acceptWork = vi.mocked(acceptCollaborativeRevisionWork);
const rejectWork = vi.mocked(rejectCollaborativeRevisionWork);
const updateUnit = vi.fn();

const preparedUnit: DraftUnit = {
  id: "unit-prepared",
  projectId: "project-1",
  granularity: "paragraph",
  targetWordCount: 200,
  thesis: "Unité préparée",
  contextInPlan: { section: "section-1" },
  evidencePack: {
    sourceIds: [],
    keyCitations: [],
    supportingClaimIds: [],
    objections: [],
  },
  content: "Texte canonique.",
  claimIds: [],
  citationUses: [],
  appliedDecisionIds: [],
  appliedArticulationIds: [],
  transformationTraceIds: [],
  status: "drafting",
  version: 3,
  createdAt: "2026-09-12T10:00:00.000Z",
  updatedAt: "2026-09-12T10:00:00.000Z",
};

const collaborativeWork = {
  id: "revision-work:1",
  unitId: preparedUnit.id,
  base: {
    unitId: preparedUnit.id,
    unitVersion: 3,
    contentHash: "a".repeat(64),
    content: preparedUnit.content,
  },
  proposedContent: "Proposition collaborative.",
  status: "working" as const,
};

function renderEditor(
  reviseChat: (unitId: string, instruction: string) => Promise<RevisionSuggestionPayload | undefined>
) {
  useProjectUnits.mockReturnValue({
    units: [preparedUnit],
    loading: false,
    error: null,
    reload: vi.fn(),
    add: vi.fn(),
    update: updateUnit,
    generate: vi.fn(),
    split: vi.fn(),
    mergeNext: vi.fn(),
    reviseChat,
    evaluate: vi.fn(),
    evaluateIntegrated: vi.fn(),
    verify: vi.fn(),
  });
  useProjectNavigation.mockReturnValue({
    entries: [],
    loading: false,
    error: null,
    reload: vi.fn(),
  });

  render(
    <MemoryRouter initialEntries={["/projects/project-1/editor?unitId=unit-prepared"]}>
      <Routes>
        <Route path="/projects/:projectId/editor" element={<EditorPage />} />
      </Routes>
    </MemoryRouter>
  );
}

async function requestRevision() {
  await screen.findByRole("textbox", { name: "Manuscrit : Unité préparée" });
  fireEvent.click(screen.getByRole("button", { name: "Ouvrir les outils" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Instruction de révision" }), {
    target: { value: "Resserre le passage." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Réviser" }));
  return screen.findByRole("region", { name: "Proposition de révision" });
}

describe("EditorPage collaborative revision compatibility", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    updateUnit.mockResolvedValue(preparedUnit);
  });

  it("sends edited collaborative content to backend accept and never directly patches the DraftUnit", async () => {
    const reviseChat = vi.fn().mockResolvedValue({
      kind: "collaborative",
      work: collaborativeWork,
    } satisfies RevisionSuggestionPayload);
    const integratedUnit = {
      ...preparedUnit,
      content: "Proposition éditée.",
      version: 4,
    };
    acceptWork.mockResolvedValue({
      kind: "collaborative",
      status: "integrated",
      work: { ...collaborativeWork, proposedContent: "Proposition éditée.", status: "integrated" },
      unit: integratedUnit,
    });
    renderEditor(reviseChat);

    await requestRevision();
    expect(screen.getByText("Proposition de révision")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Texte proposé" }), {
      target: { value: "Proposition éditée." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Appliquer la proposition" }));

    await vi.waitFor(() =>
      expect(acceptWork).toHaveBeenCalledWith(
        "project-1",
        "unit-prepared",
        collaborativeWork.id,
        "Proposition éditée."
      )
    );
    expect(updateUnit).not.toHaveBeenCalled();
    expect(await screen.findByRole("textbox", { name: "Manuscrit : Unité préparée" })).toHaveValue(
      "Proposition éditée."
    );
    expect(screen.queryByRole("region", { name: "Proposition de révision" })).not.toBeInTheDocument();
  });

  it("rejects collaborative work through the backend without changing canonical text", async () => {
    const reviseChat = vi.fn().mockResolvedValue({
      kind: "collaborative",
      work: collaborativeWork,
    } satisfies RevisionSuggestionPayload);
    rejectWork.mockResolvedValue({
      kind: "collaborative",
      status: "rejected",
      work: { ...collaborativeWork, status: "rejected" },
    });
    renderEditor(reviseChat);

    await requestRevision();
    fireEvent.click(screen.getByRole("button", { name: "Refuser la proposition" }));

    await waitFor(() => {
      expect(rejectWork).toHaveBeenCalledWith("project-1", "unit-prepared", collaborativeWork.id);
      expect(screen.queryByRole("region", { name: "Proposition de révision" })).not.toBeInTheDocument();
    });
    expect(updateUnit).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Manuscrit : Unité préparée" })).toHaveValue(
      "Texte canonique."
    );
  });

  it("keeps collaborative apply backend-authoritative when local text makes the proposal look stale", async () => {
    const reviseChat = vi.fn().mockResolvedValue({
      kind: "collaborative",
      work: collaborativeWork,
    } satisfies RevisionSuggestionPayload);
    acceptWork.mockResolvedValue({
      kind: "collaborative",
      status: "stale",
      work: { ...collaborativeWork, status: "stale" },
      conflicts: [{ kind: "textual", reason: "Le texte canonique a évolué." }],
    });
    renderEditor(reviseChat);

    await requestRevision();
    fireEvent.change(screen.getByRole("textbox", { name: "Manuscrit : Unité préparée" }), {
      target: { value: "Modification locale concurrente." },
    });
    expect(screen.getByText("Proposition périmée")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Appliquer la proposition" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Appliquer la proposition" }));

    await vi.waitFor(() => expect(acceptWork).toHaveBeenCalledTimes(1));
    expect(updateUnit).not.toHaveBeenCalled();
    expect(await screen.findByText("Le texte a évolué depuis cette proposition. Elle reste consultable mais ne peut pas être appliquée.")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Proposition de révision" })).toBeInTheDocument();
  });

  it("keeps legacy proposals on the existing explicit local apply path", async () => {
    const legacyProposal = {
      id: "proposal-legacy",
      projectId: "project-1",
      unitId: preparedUnit.id,
      sourceVersion: 3,
      before: preparedUnit.content,
      content: "Proposition legacy.",
      status: "available" as const,
      createdAt: "2026-09-12T10:00:00.000Z",
      updatedAt: "2026-09-12T10:00:00.000Z",
    };
    const reviseChat = vi.fn().mockResolvedValue({ proposal: legacyProposal } satisfies RevisionSuggestionPayload);
    updateUnit.mockResolvedValue({ ...preparedUnit, content: legacyProposal.content, version: 4 });
    renderEditor(reviseChat);

    await requestRevision();
    fireEvent.click(screen.getByRole("button", { name: "Appliquer la proposition" }));

    await vi.waitFor(() =>
      expect(updateUnit).toHaveBeenCalledWith("unit-prepared", {
        content: "Proposition legacy.",
        version: 4,
      })
    );
    expect(acceptWork).not.toHaveBeenCalled();
    expect(rejectWork).not.toHaveBeenCalled();
  });
});