import { describe, expect, it } from "vitest";
import type { IngestedDocument, Source } from "../src/domain";
import {
  assessComprehensionClosure,
  buildProfiles,
  buildSectionSynopsisPrompt,
  createLibrary,
  mergeLibraryProfiles,
  selectDocumentsNeedingProfiles,
  selectUnprofiled,
} from "../src/bibliography/bibliography";
import {
  SourceProfileSchema,
  isComprehensionReady,
  type SourceProfile,
} from "../src/domain/sourceProfile";

const sources: Source[] = Array.from({ length: 3 }, (_, index) => ({
  id: `src-${index}`,
  projectId: "project-1",
  type: "book" as const,
  title: `Ouvrage ${index}`,
  authors: [`Auteur ${index}`],
  content: "",
  epistemicLimits: [],
  annotations: [],
  verificationStatus: "unverified" as const,
  tags: [],
}));

function makeDocument(
  sourceId: string,
  fingerprintCharacter: string,
  ingestionStatus: "ready" | "degraded" | "unreadable" = "ready"
): IngestedDocument {
  if (ingestionStatus === "unreadable") {
    return {
      id: `doc-${sourceId}`,
      sourceId,
      fingerprint: fingerprintCharacter.repeat(64),
      blocks: [],
      ingestionStatus,
      diagnostics: ["No text"],
    };
  }

  return {
    id: `doc-${sourceId}`,
    sourceId,
    fingerprint: fingerprintCharacter.repeat(64),
    ingestionStatus,
    diagnostics: [],
    blocks: [
      {
        id: `${sourceId}-b0`,
        kind: "heading",
        order: 0,
        text: "Introduction",
        sectionPath: ["Introduction"],
        locator: { kind: "section", value: "Introduction" },
      },
      {
        id: `${sourceId}-b1`,
        kind: "paragraph",
        order: 1,
        text: "Archive institutions classify populations.",
        sectionPath: ["Introduction"],
        locator: { kind: "other", value: "line:2" },
      },
      {
        id: `${sourceId}-b2`,
        kind: "heading",
        order: 2,
        text: "Contestations",
        sectionPath: ["Introduction", "Contestations"],
        locator: { kind: "section", value: "Contestations" },
      },
      {
        id: `${sourceId}-b3`,
        kind: "paragraph",
        order: 3,
        text: "Later actors contest the inherited category.",
        sectionPath: ["Introduction", "Contestations"],
        locator: { kind: "other", value: "line:4" },
      },
    ],
  };
}

function fakeClient() {
  const prompts: string[] = [];
  return {
    prompts,
    client: {
      async generateJson(prompt: string): Promise<unknown> {
        prompts.push(prompt);
        if (prompt.includes("JSON strict attendu : {\"synopsis\"")) {
          return { synopsis: `Synopsis ${prompts.length}` };
        }
        return {
          subjects: ["classification"],
          concepts: ["archive", "contestation"],
          abstract: "Le document suit la production puis la contestation d'une catégorie.",
        };
      },
    },
  };
}

describe("SourceProfile Corpus V2", () => {
  it("keeps legacy compact profiles parseable but never comprehension-ready", () => {
    const legacy = SourceProfileSchema.parse({
      sourceId: "src-legacy",
      subjects: ["archive"],
      concepts: [],
    });

    expect(isComprehensionReady(legacy)).toBe(false);
    expect(legacy.fingerprint).toBeUndefined();
    expect(legacy.comprehension).toBeUndefined();
  });

  it("builds section prompts from ingested content rather than metadata", () => {
    const document = makeDocument("src-0", "a");
    const prompt = buildSectionSynopsisPrompt(
      document,
      ["Introduction"],
      document.blocks.slice(0, 2)
    );

    expect(prompt).toContain("Archive institutions classify populations.");
    expect(prompt).toContain("src-0-b1");
    expect(prompt).toContain("aucune connaissance générale");
  });

  it("reduces every non-excluded block into an anchored ready profile", async () => {
    const document = makeDocument("src-0", "a");
    const { client, prompts } = fakeClient();

    const [profile] = await buildProfiles([document], client);

    expect(prompts).toHaveLength(3); // 2 sections + document synthesis
    expect(profile.fingerprint).toBe(document.fingerprint);
    expect(profile.comprehension).toEqual({
      totalBlocks: 4,
      coveredBlockIds: ["src-0-b0", "src-0-b1", "src-0-b2", "src-0-b3"],
      excludedBlockIds: [],
      status: "ready",
    });
    expect(profile.sections?.map((section) => section.blockIds)).toEqual([
      ["src-0-b0", "src-0-b1"],
      ["src-0-b2", "src-0-b3"],
    ]);
    expect(isComprehensionReady(profile)).toBe(true);
  });

  it("allows explicit block exclusion while keeping complete accounting", async () => {
    const document = makeDocument("src-0", "a");
    const { client } = fakeClient();

    const [profile] = await buildProfiles([document], client, {
      excludedBlockIdsByDocumentId: {
        [document.id]: ["src-0-b2"],
      },
    });

    expect(profile.comprehension?.coveredBlockIds).toEqual([
      "src-0-b0",
      "src-0-b1",
      "src-0-b3",
    ]);
    expect(profile.comprehension?.excludedBlockIds).toEqual(["src-0-b2"]);
    expect(profile.comprehension?.status).toBe("ready");
  });

  it("never upgrades degraded or unreadable ingestion to ready comprehension", async () => {
    const degraded = makeDocument("src-1", "b", "degraded");
    const unreadable = makeDocument("src-2", "c", "unreadable");
    const { client } = fakeClient();

    const [degradedProfile, unreadableProfile] = await buildProfiles(
      [degraded, unreadable],
      client
    );

    expect(degradedProfile.comprehension?.status).toBe("degraded");
    expect(unreadableProfile.comprehension?.status).toBe("unreadable");
    expect(unreadableProfile.sections).toEqual([]);
  });

  it("rejects exclusion ids that are not present in the canonical document", async () => {
    const document = makeDocument("src-0", "a");
    const { client } = fakeClient();

    await expect(
      buildProfiles([document], client, {
        excludedBlockIdsByDocumentId: { [document.id]: ["missing"] },
      })
    ).rejects.toThrow("unknown block 'missing'");
  });
});

describe("Comprehension Closure", () => {
  it("blocks legacy, stale, degraded and unreadable sources unless explicitly excluded", async () => {
    const ready = makeDocument("src-0", "a");
    const stale = makeDocument("src-1", "b");
    const unreadable = makeDocument("src-2", "c", "unreadable");
    const { client } = fakeClient();
    const [readyProfile] = await buildProfiles([ready], client);
    const staleProfile: SourceProfile = {
      ...readyProfile,
      sourceId: "src-1",
      fingerprint: "d".repeat(64),
    };

    const closure = assessComprehensionClosure(
      [ready, stale, unreadable],
      [readyProfile, staleProfile],
      ["src-2"]
    );

    expect(closure).toEqual({
      readySourceIds: ["src-0"],
      blockingSourceIds: ["src-1"],
      excludedSourceIds: ["src-2"],
      complete: false,
    });
  });

  it("closes only when every active source has a current ready profile", async () => {
    const first = makeDocument("src-0", "a");
    const second = makeDocument("src-1", "b");
    const unreadable = makeDocument("src-2", "c", "unreadable");
    const { client } = fakeClient();
    const profiles = await buildProfiles([first, second], client);

    const closure = assessComprehensionClosure(
      [first, second, unreadable],
      profiles,
      ["src-2"]
    );

    expect(closure.complete).toBe(true);
    expect(closure.readySourceIds).toEqual(["src-0", "src-1"]);
    expect(closure.blockingSourceIds).toEqual([]);
  });

  it("reuses matching profiles and rebuilds when the document fingerprint changes", async () => {
    const firstVersion = makeDocument("src-0", "a");
    const nextVersion = makeDocument("src-0", "b");
    const { client } = fakeClient();
    const [profile] = await buildProfiles([firstVersion], client);

    expect(selectDocumentsNeedingProfiles([firstVersion], [profile])).toEqual([]);
    expect(selectDocumentsNeedingProfiles([nextVersion], [profile])).toEqual([
      nextVersion,
    ]);
  });
});

describe("legacy library helpers", () => {
  it("upserts profiles by sourceId without mutating the input", () => {
    const library = createLibrary(sources);
    const first: SourceProfile = {
      sourceId: "src-0",
      subjects: ["a"],
      concepts: [],
    };
    const merged = mergeLibraryProfiles(library, [first]);
    expect(merged.profiles).toHaveLength(1);
    expect(library.profiles).toHaveLength(0);

    const replacement: SourceProfile = {
      sourceId: "src-0",
      subjects: ["b"],
      concepts: [],
    };
    const mergedAgain = mergeLibraryProfiles(merged, [replacement]);
    expect(mergedAgain.profiles).toHaveLength(1);
    expect(mergedAgain.profiles[0].subjects).toEqual(["b"]);
  });

  it("selectUnprofiled remains a legacy source-level helper", () => {
    const profiles: SourceProfile[] = [
      { sourceId: "src-0", subjects: [], concepts: [] },
    ];
    const remaining = selectUnprofiled(sources, profiles);
    expect(remaining.map((source) => source.id)).toEqual(["src-1", "src-2"]);
  });
});
