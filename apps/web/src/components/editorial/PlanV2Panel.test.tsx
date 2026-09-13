import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DiffractiveReading } from "@auto-essay/core";
import {
  applyPlanningStructuralDiff,
  createPlanningStructuralDiff,
  diffractPlanningArchitecture,
  fetchPlanningGrill,
  fetchPlanningState,
  proposePlanningDecomposition,
} from "@/api/planning";
import { PlanV2Panel } from "./PlanV2Panel";

vi.mock("@/api/planning", () => ({
  fetchPlanningState: vi.fn(),
  fetchPlanningGrill: vi.fn(),
  explorePlanningSubjects: vi.fn(),
  refinePlanning: vi.fn(),
  createPlanningBriefFromSubjectRequest: vi.fn(),
  supersedePlanningBriefRequest: vi.fn(),
  proposePlanningDecomposition: vi.fn(),
  diffractPlanningArchitecture: vi.fn(),
  createPlanningStructuralDiff: vi.fn(),
  applyPlanningStructuralDiff: vi.fn(),
}));

const state = vi.mocked(fetchPlanningState);
const grill = vi.mocked(fetchPlanningGrill);
const decompose = vi.mocked(proposePlanningDecomposition);
const diffract = vi.mocked(diffractPlanningArchitecture);
const makeDiff = vi.mocked(createPlanningStructuralDiff);
const applyDiff = vi.mocked(applyPlanningStructuralDiff);

const now = "2026-09-13T00:00:00.000Z";
const brief = {
  id: "brief-1",
  projectId: "project-1",
  scopeRef: {
    kind: "node" as const,
    projectId: "project-1",
    manuscriptId: "manuscript-1",
    nodeId: "chapter-1",
  },
  version: 1,
  question: "Comment organiser la mémoire ?",
  angleOrFunction: "Confronter deux régimes documentaires",
  hypotheses: [{ statement: "Deux régimes s’opposent", status: "emergent" as const, sourceRefs: ["source-1"] }],
  gaps: [],
  constraints: [],
  sourceRefs: ["source-1"],
  createdAt: now,
  updatedAt: now,
};

const architecture = {
  nextLevel: "section" as const,
  structuralDecision: "Séparer les régimes documentaires",
  children: [{
    title: "Archives institutionnelles",
    level: "section" as const,
    rationale: "Tester la première hypothèse",
    inheritedConstraintRefs: [],
    hypothesisTreatments: [{ hypothesisIndex: 0, kind: "test" as const, rationale: "Mettre l’hypothèse à l’épreuve" }],
  }],
};

const change = {
  id: "change-1",
  kind: "create_node" as const,
  parentNodeId: "chapter-1",
  index: 0,
  node: { id: "section-new", title: "Archives institutionnelles" },
  reason: "Tester la première hypothèse",
  consequences: ["Mettre l’hypothèse à l’épreuve"],
};

const reading: DiffractiveReading = {
  id: "reading-1",
  fragment: { statement: "Décomposition proposée", claimIds: [], sourceIds: ["source-1"] },
  pass1: { refraction: ["La séparation rend le conflit documentaire plus visible."] },
  pass2: { namedPatterns: ["Hiérarchie des archives"], revealedDefaults: [] },
  pass3: {
    entanglements: [{
      name: "Autorité documentaire",
      cutIfIntegrated: "Séparer les régimes au lieu de les synthétiser",
      becomesIntelligible: ["La concurrence des archives"],
      becomesUnintelligible: ["Une mémoire unifiée"],
    }],
  },
  pass4: {
    cut: "Maintenir deux régimes distincts",
    included: ["Conflit documentaire"],
    excluded: ["Synthèse prématurée"],
    cutOfNonAdoption: ["Le conflit reste implicite"],
  },
  verdict: "adapt_differently",
  verdictDetail: "Conserver la tension et documenter la seconde archive.",
  action: "Ajouter une source contradictoire avant stabilisation.",
  tradeoffs: [{
    path: "Séparer les régimes",
    effort: "modéré",
    reversibility: "forte",
    leverage: "rend le conflit lisible",
    distractionTax: "ajoute une section",
    verdict: "adapt_differently",
  }],
  planImpacts: [{
    partId: "chapter-2",
    partTitle: "Conséquences",
    impact: "La comparaison devra être reprise plus loin.",
  }],
  bibliographyImpacts: [{
    sourceId: "source-missing",
    scopeId: "chapter-1",
    kind: "manquante",
    impact: "Une contre-archive manque pour tester la symétrie.",
  }],
  createdAt: now,
};

function renderPanel(onApplied = vi.fn()) {
  return render(
    <MemoryRouter>
      <PlanV2Panel
        projectId="project-1"
        chapterId="chapter-1"
        writingHref="/write"
        onApplied={onApplied}
      />
    </MemoryRouter>
  );
}

describe("PlanV2Panel", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    state.mockResolvedValue({
      manuscriptId: "manuscript-1",
      mode: "existing_plan",
      activeBrief: brief,
      readiness: { ready: false, reasons: ["scope role in its parent is not understood"], authorDecisionNeeded: false, blockedBySources: false },
      coverage: { registeredSourceCount: 2, representedSourceCount: 1, explorationComplete: false, note: "L’absence n’est pas prouvée." },
    });
    grill.mockResolvedValue({
      round: 0,
      questions: [{
        id: "intention",
        prompt: "Quelle transformation ce chapitre doit-il produire ?",
        impact: "scope_meaning",
        wouldChangePlanning: true,
      }],
    });
    decompose.mockResolvedValue({ scopeBriefId: brief.id, architectures: [architecture] });
    diffract.mockResolvedValue(reading);
    makeDiff.mockResolvedValue({ changes: [change] });
    applyDiff.mockResolvedValue({ appliedChangeIds: [change.id] });
  });

  it("attaches automatic Diffract advice to the proposal and keeps manual reruns advisory", async () => {
    renderPanel();
    await screen.findByText("Couverture documentaire");

    fireEvent.click(screen.getByRole("button", { name: "Proposer une structure" }));
    expect(await screen.findByText("Séparer les régimes documentaires")).toBeInTheDocument();
    await waitFor(() => expect(diffract).toHaveBeenCalledWith(brief, architecture));

    const review = await screen.findByRole("region", { name: "Diffract : Séparer les régimes documentaires" });
    expect(review).toHaveTextContent("Autorité documentaire");
    expect(review).toHaveTextContent("Conséquences");
    expect(review).toHaveTextContent("Une contre-archive manque");
    expect(review).toHaveTextContent("Valider la structure ne transforme pas ces lacunes en soutien documentaire.");
    expect(applyDiff).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Relancer Diffract" }));
    await waitFor(() => expect(diffract).toHaveBeenCalledTimes(2));
    expect(applyDiff).not.toHaveBeenCalled();
  });

  it("does not let a Diffract failure block the structural proposal", async () => {
    diffract.mockRejectedValueOnce(new Error("Diffract indisponible"));
    renderPanel();
    await screen.findByText("Couverture documentaire");

    fireEvent.click(screen.getByRole("button", { name: "Proposer une structure" }));
    expect(await screen.findByText("Lecture Diffract indisponible. La proposition reste utilisable.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Préparer les changements" }));
    expect(await screen.findByText("Aucun changement n’est appliqué avant votre validation.")).toBeInTheDocument();
    expect(makeDiff).toHaveBeenCalledWith("project-1", brief.id, architecture);
    expect(applyDiff).not.toHaveBeenCalled();
  });

  it("keeps structural proposals local until author validation, supports refusal, and applies the edited diff", async () => {
    const onApplied = vi.fn();
    renderPanel(onApplied);

    expect(await screen.findByText("Couverture documentaire")).toBeInTheDocument();
    expect(await screen.findByText("Quelle transformation ce chapitre doit-il produire ?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Proposer une structure" }));
    expect(await screen.findByText("Séparer les régimes documentaires")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Préparer les changements" }));
    expect(await screen.findByText("Aucun changement n’est appliqué avant votre validation.")).toBeInTheDocument();
    expect(applyDiff).not.toHaveBeenCalled();
    expect(onApplied).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "Titre refusé" } });
    fireEvent.click(screen.getByRole("button", { name: "Refuser" }));
    expect(applyDiff).not.toHaveBeenCalled();
    expect(onApplied).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Préparer les changements" }));
    await screen.findByText("Aucun changement n’est appliqué avant votre validation.");
    fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "Titre édité par l’auteur" } });
    fireEvent.click(screen.getByRole("button", { name: "Valider" }));

    const editedChange = {
      ...change,
      node: { ...change.node, title: "Titre édité par l’auteur" },
    };
    await waitFor(() => expect(applyDiff).toHaveBeenCalledTimes(1));
    expect(applyDiff).toHaveBeenCalledWith("project-1", [editedChange]);
    expect(onApplied).toHaveBeenCalledTimes(1);
  });
});
