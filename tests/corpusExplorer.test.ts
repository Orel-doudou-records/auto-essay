import { describe, expect, it } from "vitest";
import type { IngestedDocument } from "../src/domain/index.js";
import {
  createCorpusExplorer,
  type CorpusLocator,
} from "../src/bibliography/corpusExplorer.js";
import { createPlanningCorpusSnapshot } from "../src/editorial/planningCorpusAdapter.js";

function document(
  id: string,
  sourceId: string,
  fingerprintCharacter: string,
  blocks: Array<{ id: string; order: number; text: string; section: string }>
): IngestedDocument {
  return {
    id,
    sourceId,
    fingerprint: fingerprintCharacter.repeat(64),
    ingestionStatus: "ready",
    diagnostics: [],
    blocks: blocks.map((block) => ({
      id: block.id,
      kind: "paragraph",
      order: block.order,
      text: block.text,
      sectionPath: [block.section],
      locator: { kind: "section", value: block.section },
    })),
  };
}

const corpus: IngestedDocument[] = [
  document("doc-a", "source-a", "a", [
    {
      id: "a-1",
      order: 0,
      text: "Archive institutions classify populations into a durable category.",
      section: "Classification",
    },
    {
      id: "a-2",
      order: 1,
      text: "The category circulates through administrative records.",
      section: "Administration",
    },
  ]),
  document("doc-b", "source-b", "b", [
    {
      id: "b-1",
      order: 0,
      text: "Later actors dispute the inherited category and reject its stability.",
      section: "Contestation",
    },
  ]),
];

describe("CorpusExplorer", () => {
  it("uses one port but diversifies local exploration across sources", async () => {
    const explorer = createCorpusExplorer(corpus);
    const passages = await explorer.retrieve({
      mode: "exploration",
      query: "category",
      limit: 2,
    });

    expect(passages).toHaveLength(2);
    expect(passages.map((passage) => passage.sourceId)).toEqual([
      "source-a",
      "source-b",
    ]);
    expect(passages.every((passage) => passage.mode === "exploration")).toBe(true);
    expect(passages.every((passage) => passage.probe === undefined)).toBe(true);
  });

  it("supports typed corroboration probes without producing a verdict", async () => {
    const explorer = createCorpusExplorer(corpus);

    const support = await explorer.retrieve({
      mode: "corroboration",
      probe: "support",
      query: "institutions classify",
      limit: 1,
    });
    const contradiction = await explorer.retrieve({
      mode: "corroboration",
      probe: "contradiction",
      query: "actors dispute reject",
      limit: 1,
    });

    expect(support[0]).toMatchObject({
      sourceId: "source-a",
      probe: "support",
      mode: "corroboration",
    });
    expect(contradiction[0]).toMatchObject({
      sourceId: "source-b",
      probe: "contradiction",
      mode: "corroboration",
    });
    expect(contradiction[0]?.text).toContain("reject its stability");
  });

  it("requires a probe for corroboration and rejects probes in exploration", async () => {
    const explorer = createCorpusExplorer(corpus);

    await expect(
      explorer.retrieve({ mode: "corroboration", query: "category" })
    ).rejects.toThrow("requires an explicit probe");
    await expect(
      explorer.retrieve({
        mode: "exploration",
        query: "category",
        probe: "support",
      })
    ).rejects.toThrow("does not accept a corroboration probe");
  });

  it("rematerializes a fake backend location from canonical document text", async () => {
    const locator: CorpusLocator = async () => [
      {
        documentId: "doc-a",
        blockId: "a-1",
        start: 0,
        end: 7,
        reason: "fake-backend-location",
      },
    ];
    const explorer = createCorpusExplorer(corpus, locator);
    const [passage] = await explorer.retrieve({
      mode: "exploration",
      query: "ignored by fake backend",
    });

    expect(passage.text).toBe("Archive");
    expect(passage.span).toEqual({
      documentId: "doc-a",
      blockId: "a-1",
      start: 0,
      end: 7,
    });
    expect(passage.fingerprint).toBe("a".repeat(64));
    expect(passage.locator).toEqual({ kind: "section", value: "Classification" });
    expect(passage.reason).toBe("fake-backend-location");
  });

  it("rejects locations that cannot be resolved against canonical documents", async () => {
    const locator: CorpusLocator = async () => [
      { documentId: "doc-a", blockId: "missing" },
    ];
    const explorer = createCorpusExplorer(corpus, locator);

    await expect(
      explorer.retrieve({ mode: "exploration", query: "category" })
    ).rejects.toThrow("unknown block 'missing'");
  });

  it("bridges RetrievedPassage into the transient Plan V2 snapshot", async () => {
    const explorer = createCorpusExplorer(corpus);
    const passages = await explorer.retrieve({
      mode: "exploration",
      query: "category",
      limit: 2,
    });

    const snapshot = createPlanningCorpusSnapshot({
      registeredSourceCount: 2,
      exploredSourceIds: ["source-a", "source-b", "source-b"],
      explorationComplete: true,
      passages,
    });

    expect(snapshot.exploredSourceIds).toEqual(["source-a", "source-b"]);
    expect(snapshot.passages[0]).toMatchObject({
      id: passages[0]?.id,
      sourceId: passages[0]?.sourceId,
      text: passages[0]?.text,
      locator: "section:Classification",
    });
  });
});
