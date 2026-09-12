import { describe, expect, it } from "vitest";
import {
  createManuscript,
  createManuscriptNode,
  createPlanningBrief,
  diffractDecompositionProposal,
  proposeAdaptiveDecomposition,
} from "../src/index.js";
import type { StructuredModelClient } from "../src/evaluation/evaluateEssay.js";

class QueueClient implements StructuredModelClient {
  constructor(private readonly outputs: unknown[]) {}

  async generateJson(): Promise<unknown> {
    if (this.outputs.length === 0) throw new Error("No queued model output");
    return this.outputs.shift();
  }
}

function manuscriptFixture() {
  const chapter = createManuscriptNode({
    id: "chapter-1",
    title: "Chapter 1",
  });
  const manuscript = createManuscript({
    projectId: "project-1",
    title: "Essay",
    tree: [chapter],
  });
  return { manuscript };
}

function richBrief() {
  const { manuscript } = manuscriptFixture();
  const brief = createPlanningBrief({
    manuscript,
    scopeRef: {
      kind: "manuscript",
      projectId: manuscript.projectId,
      manuscriptId: manuscript.id,
    },
    question: "How does the archive reshape political memory?",
    hypotheses: [
      {
        statement: "Institutional archives stabilize one public narrative",
        status: "supported",
        sourceRefs: ["source-1"],
      },
      {
        statement: "Counter-archives may reorganize that narrative",
        status: "under_documented",
        sourceRefs: ["source-2"],
      },
    ],
    gaps: [
      {
        description: "Counter-archive testimony is incomplete",
        consequence: "The second hypothesis must remain provisional",
        neededEvidence: "Primary testimony",
      },
    ],
    constraints: ["Do not collapse institutional and vernacular archives"],
    sourceRefs: ["source-1", "source-2"],
  });
  return { manuscript, brief };
}

describe("adaptive planning decomposition", () => {
  it("allows skipped levels with one justified architecture", async () => {
    const { brief } = richBrief();
    const client = new QueueClient([
      {
        architectures: [
          {
            nextLevel: "chapter",
            structuralDecision: "Organize by competing archive regimes",
            children: [
              {
                title: "Institutional memory",
                level: "chapter",
                rationale: "Tests how official archives stabilize a narrative",
                inheritedConstraintRefs: [0],
                hypothesisTreatments: [
                  {
                    hypothesisIndex: 0,
                    kind: "test",
                    rationale: "This chapter directly tests the supported hypothesis",
                  },
                  {
                    hypothesisIndex: 1,
                    kind: "keep_open",
                    rationale: "The counter-archive claim remains provisional here",
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);

    const result = await proposeAdaptiveDecomposition(brief, client);
    expect(result.architectures).toHaveLength(1);
    expect(result.architectures[0]?.nextLevel).toBe("chapter");
    expect(result.architectures[0]?.children[0]?.rationale).toContain("official archives");
    expect(result.architectures[0]?.children[0]?.inheritedConstraintRefs).toEqual([0]);
  });

  it("accepts several alternatives only when structural decisions are distinct", async () => {
    const { brief } = richBrief();
    const client = new QueueClient([
      {
        architectures: [
          {
            nextLevel: "part",
            structuralDecision: "Chronological parts",
            whyDifferent: "Makes historical transformation the primary organizing principle",
            children: [
              {
                title: "Formation",
                level: "part",
                rationale: "Establishes the first historical configuration",
                inheritedConstraintRefs: [],
                hypothesisTreatments: [],
              },
            ],
          },
          {
            nextLevel: "chapter",
            structuralDecision: "Thematic chapters",
            whyDifferent: "Makes competing archive regimes the primary organizing principle",
            children: [
              {
                title: "Official archive",
                level: "chapter",
                rationale: "Groups evidence by documentary regime rather than chronology",
                inheritedConstraintRefs: [],
                hypothesisTreatments: [],
              },
            ],
          },
        ],
      },
    ]);

    const result = await proposeAdaptiveDecomposition(brief, client);
    expect(result.architectures).toHaveLength(2);
  });

  it("rejects duplicate pseudo-alternatives", async () => {
    const { brief } = richBrief();
    const client = new QueueClient([
      {
        architectures: [
          {
            nextLevel: "chapter",
            structuralDecision: "Thematic chapters",
            whyDifferent: "A",
            children: [
              {
                title: "A",
                level: "chapter",
                rationale: "A",
                inheritedConstraintRefs: [],
                hypothesisTreatments: [],
              },
            ],
          },
          {
            nextLevel: "chapter",
            structuralDecision: "thematic chapters",
            whyDifferent: "B",
            children: [
              {
                title: "B",
                level: "chapter",
                rationale: "B",
                inheritedConstraintRefs: [],
                hypothesisTreatments: [],
              },
            ],
          },
        ],
      },
    ]);

    await expect(proposeAdaptiveDecomposition(brief, client)).rejects.toThrow(
      "Multiple architectures must differ on a real structural decision"
    );
  });

  it("keeps under-documented hypotheses open or gap-blocked", async () => {
    const { brief } = richBrief();
    const client = new QueueClient([
      {
        architectures: [
          {
            nextLevel: "chapter",
            structuralDecision: "Test the provisional counter-archive claim",
            children: [
              {
                title: "Counter-archives",
                level: "chapter",
                rationale: "Keeps the documentary gap visible",
                inheritedConstraintRefs: [],
                hypothesisTreatments: [
                  {
                    hypothesisIndex: 1,
                    kind: "test",
                    rationale: "Treat as established",
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);

    await expect(proposeAdaptiveDecomposition(brief, client)).rejects.toThrow(
      "cannot be stabilized by decomposition"
    );
  });

  it("can represent a full semantic chain without adding node subclasses", async () => {
    const { manuscript } = manuscriptFixture();
    const levels = ["part", "chapter", "section", "paragraph"] as const;

    for (const level of levels) {
      const brief = createPlanningBrief({
        manuscript,
        scopeRef: {
          kind: "manuscript",
          projectId: manuscript.projectId,
          manuscriptId: manuscript.id,
        },
        question: `What ${level} is needed next?`,
      });
      const client = new QueueClient([
        {
          architectures: [
            {
              nextLevel: level,
              structuralDecision: `Use ${level} as the next useful level`,
              children: [
                {
                  title: `A ${level}`,
                  level,
                  rationale: `This ${level} has a distinct editorial function`,
                  inheritedConstraintRefs: [],
                  hypothesisTreatments: [],
                },
              ],
            },
          ],
        },
      ]);

      const result = await proposeAdaptiveDecomposition(brief, client);
      expect(result.architectures[0]?.nextLevel).toBe(level);
    }
  });

  it("routes a proposal through the existing Diffract reader before stabilization", async () => {
    const { brief } = richBrief();
    const proposal = {
      nextLevel: "chapter" as const,
      structuralDecision: "Organize by archive regime",
      children: [
        {
          title: "Institutional archive",
          level: "chapter" as const,
          rationale: "Tests the official narrative",
          inheritedConstraintRefs: [],
          hypothesisTreatments: [],
        },
      ],
    };
    const client = new QueueClient([
      {
        pass1: { refraction: [] },
        pass2: { namedPatterns: [], revealedDefaults: [] },
        pass3: { entanglements: [] },
        pass4: {
          cut: "Keep the decomposition advisory",
          included: ["chapter structure"],
          excluded: ["automatic manuscript mutation"],
          cutOfNonAdoption: [],
        },
        verdict: "integrate_now",
        verdictDetail: "Structure is coherent",
        action: "Submit to author checkpoint",
        tradeoffs: [],
        planImpacts: [],
        bibliographyImpacts: [],
      },
    ]);

    const reading = await diffractDecompositionProposal(brief, proposal, client);
    expect(reading.verdict).toBe("integrate_now");
    expect(reading.fragment.sourceIds).toEqual(["source-1", "source-2"]);
  });
});
