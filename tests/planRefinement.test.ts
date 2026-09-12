import { describe, expect, it } from "vitest";
import {
  createManuscript,
  createManuscriptNode,
  createPlanEntry,
  refineExistingPlan,
  type StructuredModelClient,
} from "../src/index.js";

function fixture() {
  const p1 = createPlanEntry("Origins");
  const p2 = createPlanEntry("Institutional relay");
  const p3 = createPlanEntry("Contemporary consequence");
  const manuscript = createManuscript({
    projectId: "project-1",
    title: "Essay",
    tree: [
      createManuscriptNode({
        id: "chapter-1",
        title: "Chapter 1",
        plan: [p1, p2],
      }),
      createManuscriptNode({
        id: "chapter-2",
        title: "Chapter 2",
        plan: [p3],
      }),
    ],
  });
  return { manuscript, p1, p2, p3 };
}

function diffractOutput(p3Id: string) {
  return {
    pass1: { refraction: ["The relay repeats part of the origin sequence"] },
    pass2: {
      namedPatterns: ["institutional repetition"],
      revealedDefaults: [],
    },
    pass3: { entanglements: [] },
    pass4: {
      cut: "Preserve the existing architecture while relocating one overlap",
      included: ["author sequence"],
      excluded: ["global rewrite"],
      cutOfNonAdoption: ["redundancy remains"],
    },
    verdict: "adapt_differently",
    verdictDetail: "Relocate overlap, preserve sequence",
    action: "Move the redundant relay instead of rebuilding the plan",
    tradeoffs: [],
    planImpacts: [
      {
        partId: "chapter-2",
        partTitle: "Chapter 2",
        entryId: p3Id,
        impact: "The later consequence must keep its transition after the move",
      },
    ],
    bibliographyImpacts: [],
  };
}

function clientFor(
  first: unknown,
  second: unknown,
  prompts: string[] = []
): StructuredModelClient {
  let call = 0;
  return {
    async generateJson(prompt: string) {
      prompts.push(prompt);
      call += 1;
      return call === 1 ? first : second;
    },
  };
}

describe("refineExistingPlan", () => {
  it("preserves the canonical manuscript while surfacing move, redundancy and remote impact", async () => {
    const { manuscript, p1, p2, p3 } = fixture();
    const before = structuredClone(manuscript);
    const prompts: string[] = [];
    const client = clientFor(
      diffractOutput(p3.id),
      {
        diagnostics: [
          {
            partId: "chapter-1",
            entryId: p1.id,
            kind: "stable",
            reason: "The opening sequence remains supported by the reading",
          },
          {
            partId: "chapter-1",
            entryId: p2.id,
            kind: "redundant",
            reason: "It repeats the institutional transition",
          },
        ],
        transformations: [
          {
            kind: "move",
            partId: "chapter-1",
            entryId: p2.id,
            targetPartId: "chapter-2",
            targetEntryId: p3.id,
            current: "Institutional relay follows origins",
            proposal: "Place the relay before the contemporary consequence",
            reason: "This removes local repetition without replacing the architecture",
            consequences: ["Chapter 2 transition must be rechecked"],
            requiresAuthorDecision: true,
          },
        ],
        authorQuestions: [
          {
            id: "move-relay",
            prompt: "Should the institutional relay move to chapter 2?",
            impact: "structure",
          },
        ],
      },
      prompts
    );

    const result = await refineExistingPlan(
      {
        manuscript,
        bookBibliography: {
          entries: [{ sourceId: "source-a", title: "Archive A" }],
        },
      },
      client
    );

    expect(manuscript).toEqual(before);
    expect(result.diagnostics.map((d) => d.kind)).toEqual(["stable", "redundant"]);
    expect(result.transformations[0]?.kind).toBe("move");
    expect(result.authorQuestions[0]?.wouldChangePlanning).toBe(true);
    expect(result.remoteImpacts[0]?.partId).toBe("chapter-2");
    expect(prompts[0]).toContain("source-a");
  });

  it("keeps a documentary gap unresolved instead of inventing missing knowledge", async () => {
    const { manuscript, p1, p3 } = fixture();
    const result = await refineExistingPlan(
      { manuscript },
      clientFor(diffractOutput(p3.id), {
        diagnostics: [
          {
            partId: "chapter-1",
            entryId: p1.id,
            kind: "unsupported",
            reason: "The causal bridge lacks primary evidence",
          },
        ],
        transformations: [
          {
            kind: "mark_unresolved",
            partId: "chapter-1",
            entryId: p1.id,
            current: "Causal bridge treated as settled",
            proposal: "Keep an explicit unresolved documentary slot",
            reason: "The reading identifies a source gap",
            consequences: ["Do not draft the causal claim as established"],
            requiresAuthorDecision: false,
            missingEvidence: "Primary testimony",
          },
        ],
        authorQuestions: [],
      })
    );

    expect(result.transformations[0]).toMatchObject({
      kind: "mark_unresolved",
      missingEvidence: "Primary testimony",
    });
  });

  it("rejects candidate edits that point outside the canonical plan", async () => {
    const { manuscript, p3 } = fixture();
    await expect(
      refineExistingPlan(
        { manuscript },
        clientFor(diffractOutput(p3.id), {
          diagnostics: [],
          transformations: [
            {
              kind: "move",
              partId: "missing-part",
              current: "A",
              proposal: "B",
              reason: "C",
              consequences: [],
              requiresAuthorDecision: false,
            },
          ],
          authorQuestions: [],
        })
      )
    ).rejects.toThrow("Unknown plan part reference");
  });
});
