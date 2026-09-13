import { describe, expect, it } from "vitest";
import type { IngestedDocument } from "../src/domain";
import type { SourceProfile } from "../src/domain/sourceProfile";
import { assessComprehensionClosure } from "../src/bibliography/bibliography";

describe("Comprehension Closure canonical coverage", () => {
  it("rejects a ready-looking profile whose block ids do not match the current document", () => {
    const document: IngestedDocument = {
      id: "doc-1",
      sourceId: "source-1",
      fingerprint: "a".repeat(64),
      ingestionStatus: "ready",
      diagnostics: [],
      blocks: [
        {
          id: "block-1",
          kind: "paragraph",
          order: 0,
          text: "Canonical text",
          sectionPath: [],
          locator: { kind: "other", value: "line:1" },
        },
      ],
    };
    const forged: SourceProfile = {
      sourceId: "source-1",
      fingerprint: document.fingerprint,
      subjects: [],
      concepts: [],
      comprehension: {
        totalBlocks: 1,
        coveredBlockIds: ["not-the-canonical-block"],
        excludedBlockIds: [],
        status: "ready",
      },
    };

    expect(assessComprehensionClosure([document], [forged])).toEqual({
      readySourceIds: [],
      blockingSourceIds: ["source-1"],
      excludedSourceIds: [],
      complete: false,
    });
  });
});
