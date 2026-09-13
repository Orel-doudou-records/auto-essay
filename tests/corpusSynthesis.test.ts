import { describe, expect, it } from "vitest";
import type { IngestedDocument, SourceProfile } from "../src/domain/index.js";
import { createManuscript } from "../src/domain/index.js";
import {
  synthesizeClosedCorpus,
} from "../src/bibliography/corpusSynthesis.js";
import {
  createPlanningBriefFromSubject,
  proposePlanningSubjectsFromClosedCorpus,
} from "../src/editorial/planningSubjects.js";

function makeDocument(
  sourceId: string,
  fingerprintCharacter: string,
  blockId: string,
  text: string
): IngestedDocument {
  return {
    id: `doc-${sourceId}`,
    sourceId,
    fingerprint: fingerprintCharacter.repeat(64),
    ingestionStatus: "ready",
    diagnostics: [],
    blocks: [
      {
        id: blockId,
        kind: "paragraph",
        order: 0,
        text,
        sectionPath: ["Main"],
        locator: { kind: "section", value: "Main" },
      },
    ],
  };
}

function makeProfile(document: IngestedDocument, synopsis: string): SourceProfile {
  const blockId = document.blocks[0]!.id;
  return {
    sourceId: document.sourceId,
    subjects: ["classification"],
    concepts: ["category"],
    abstract: synopsis,
    fingerprint: document.fingerprint,
    sections: [
      {
        sectionPath: ["Main"],
        synopsis,
        blockIds: [blockId],
      },
    ],
    comprehension: {
      totalBlocks: 1,
      coveredBlockIds: [blockId],
      excludedBlockIds: [],
      status: "ready",
    },
  };
}

const documents = [
  makeDocument(
    "source-a",
    "a",
    "a-1",
    "Institutions stabilize a category through repeated administrative classification."
  ),
  makeDocument(
    "source-b",
    "b",
    "b-1",
    "A second archive shows the same category circulating through bureaucratic practice."
  ),
  makeDocument(
    "source-c",
    "c",
    "c-1",
    "The inherited category is later debated but remains institutionally legible."
  ),
  makeDocument(
    "source-d",
    "d",
    "d-1",
    "This source rejects the premise that the category was ever stable or internally coherent."
  ),
];

const profiles = [
  makeProfile(documents[0]!, "Administrative stabilization of a category."),
  makeProfile(documents[1]!, "Bureaucratic circulation of the same category."),
  makeProfile(documents[2]!, "Later debate around an inherited category."),
  makeProfile(documents[3]!, "A singular rejection of the category's presumed stability."),
];

function synthesisOutput() {
  return {
    observations: [
      {
        id: "obs-recurrence",
        kind: "recurrence",
        statement: "Sources A and B both describe institutional stabilization through practice.",
        sourceIds: ["source-a", "source-b"],
        anchors: [
          { sourceId: "source-a", blockId: "a-1" },
          { sourceId: "source-b", blockId: "b-1" },
        ],
      },
      {
        id: "obs-singularity",
        kind: "singularity",
        statement: "Source D uniquely rejects the premise of an initially stable category.",
        sourceIds: ["source-d"],
        anchors: [{ sourceId: "source-d", blockId: "d-1" }],
      },
    ],
  };
}

function passageId(document: IngestedDocument): string {
  const block = document.blocks[0]!;
  return `${document.id}:${document.fingerprint.slice(0, 16)}:${block.id}:0-${block.text.length}`;
}

function planningOutput() {
  const singular = passageId(documents[3]!);
  const recurring = passageId(documents[0]!);
  return {
    axes: [
      {
        label: "Stability versus construction",
        question: "Was stability produced institutionally or presumed retrospectively?",
        rationale: "The corpus contains both recurring stabilization and a singular rejection.",
        evidence: [
          { passageId: recurring, role: "supports" },
          { passageId: singular, role: "contests" },
        ],
        limits: [],
      },
    ],
    subjects: [
      {
        title: "The unstable category",
        question: "What changes if category stability is treated as an institutional achievement?",
        angle: "Use the singular rejection to reread the recurring administrative pattern.",
        hypotheses: ["Institutional repetition may produce the appearance of prior stability."],
        distinctiveness: "Makes the minority contradiction structurally important rather than statistically marginal.",
        evidence: [{ passageId: singular, role: "supports" }],
        limits: [],
      },
      {
        title: "Administrative recurrence",
        question: "How does bureaucratic repetition stabilize a category?",
        angle: "Compare repeated administrative practices across sources.",
        hypotheses: ["Repeated practice stabilizes the category."],
        distinctiveness: "Centers recurrence rather than the singular contradiction.",
        evidence: [{ passageId: recurring, role: "supports" }],
        limits: [],
      },
    ],
  };
}

describe("closed-corpus synthesis", () => {
  it("refuses global synthesis when comprehension closure is not satisfied", async () => {
    const staleProfiles = profiles.map((profile) => ({ ...profile }));
    staleProfiles[3] = {
      ...staleProfiles[3]!,
      fingerprint: "e".repeat(64),
    };

    await expect(
      synthesizeClosedCorpus({
        documents,
        profiles: staleProfiles,
        client: { generateJson: async () => synthesisOutput() },
      })
    ).rejects.toThrow("blocking sources: source-d");
  });

  it("is invariant to corpus input order under a deterministic client", async () => {
    const prompts: string[] = [];
    const client = {
      async generateJson(prompt: string): Promise<unknown> {
        prompts.push(prompt);
        return synthesisOutput();
      },
    };

    const first = await synthesizeClosedCorpus({ documents, profiles, client });
    const second = await synthesizeClosedCorpus({
      documents: [...documents].reverse(),
      profiles: [...profiles].reverse(),
      client,
    });

    expect(first).toEqual(second);
    expect(prompts[0]).toBe(prompts[1]);
    expect(first.sourceIds).toEqual([
      "source-a",
      "source-b",
      "source-c",
      "source-d",
    ]);
    expect(first.observations.some((item) => item.kind === "singularity")).toBe(true);
  });

  it("rejects hallucinated documentary anchors", async () => {
    const invalid = synthesisOutput();
    invalid.observations[1]!.anchors = [
      { sourceId: "source-d", blockId: "invented-block" },
    ];

    await expect(
      synthesizeClosedCorpus({
        documents,
        profiles,
        client: { generateJson: async () => invalid },
      })
    ).rejects.toThrow("unknown block 'invented-block'");
  });

  it("materializes synthesis anchors before Plan V2 and can promote a singular source into a brief", async () => {
    const prompts: string[] = [];
    const client = {
      async generateJson(prompt: string): Promise<unknown> {
        prompts.push(prompt);
        if (prompt.includes("Compare l'ensemble FERME")) return synthesisOutput();
        return planningOutput();
      },
    };

    const result = await proposePlanningSubjectsFromClosedCorpus(
      { documents, profiles },
      client,
      "Study how institutional categories become thinkable."
    );

    expect(result.retrievalCoverage).toEqual({
      anchorCount: 3,
      materializedAnchorCount: 3,
      complete: true,
    });
    expect(result.passages.map((passage) => passage.sourceId)).toEqual([
      "source-a",
      "source-b",
      "source-d",
    ]);
    expect(prompts[1]).toContain("kind=singularity");
    expect(prompts[1]).toContain(passageId(documents[3]!));
    expect(result.planning.subjects[0]?.status).toBe("supported");
    expect(result.planning.subjects[0]?.evidence[0]?.sourceId).toBe("source-d");

    const manuscript = createManuscript({ projectId: "project-1", title: "Essay" });
    const brief = createPlanningBriefFromSubject({
      manuscript,
      scopeRef: {
        kind: "manuscript",
        projectId: manuscript.projectId,
        manuscriptId: manuscript.id,
      },
      subject: result.planning.subjects[0]!,
    });

    expect(brief.sourceRefs).toEqual(["source-d"]);
    expect(brief.hypotheses[0]?.status).toBe("supported");
  });
});
