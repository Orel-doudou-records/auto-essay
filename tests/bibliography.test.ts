import { describe, expect, it } from "vitest";
import type { Source } from "../src/domain";
import {
  buildProfiles,
  buildProfilesPrompt,
  createLibrary,
  mergeLibraryProfiles,
  selectUnprofiled,
} from "../src/bibliography/bibliography";
import type { SourceProfile } from "../src/domain/sourceProfile";

const sources: Source[] = Array.from({ length: 5 }, (_, i) => ({
  id: `src-${i}`,
  type: "book" as const,
  title: `Ouvrage ${i}`,
  authors: [`Auteur ${i}`],
  content: "",
}));

describe("buildProfilesPrompt", () => {
  it("contient les métadonnées, jamais le contenu", () => {
    const prompt = buildProfilesPrompt(sources.slice(0, 2));
    expect(prompt).toContain("src-0 | Ouvrage 0 | Auteur 0");
    expect(prompt).toContain("src-1 | Ouvrage 1 | Auteur 1");
    expect(prompt).toContain('"profiles"');
  });
});

describe("buildProfiles", () => {
  it("synthétise par lots et filtre les ids inconnus", async () => {
    const calls: string[] = [];
    const fake = {
      generateJson: async (prompt: string): Promise<unknown> => {
        calls.push(prompt);
        return {
          profiles: [
            { sourceId: "src-0", subjects: ["a"], concepts: ["b"] },
            { sourceId: "inconnu", subjects: ["x"], concepts: ["y"] },
          ],
        };
      },
    };
    const profiles = await buildProfiles(sources, fake, { batchSize: 2 });
    // 5 sources / lot de 2 = 3 lots
    expect(calls).toHaveLength(3);
    // l'id inconnu est filtré ; chaque lot renvoie src-0 → 3 profils valides
    expect(profiles).toHaveLength(3);
    expect(profiles.every((p) => p.sourceId === "src-0")).toBe(true);
  });

  it("découpe exactement en lots de batchSize", async () => {
    const lots: number[] = [];
    const fake = {
      generateJson: async (): Promise<unknown> => {
        lots.push(1);
        return { profiles: [] };
      },
    };
    await buildProfiles(sources, fake, { batchSize: 3 });
    expect(lots).toHaveLength(2);
  });
});

describe("mergeLibraryProfiles / selectUnprofiled", () => {
  it("upsert par sourceId sans muter l'entrée", () => {
    const library = createLibrary(sources);
    const p0: SourceProfile = { sourceId: "src-0", subjects: ["a"], concepts: [] };
    const merged = mergeLibraryProfiles(library, [p0]);
    expect(merged.profiles).toHaveLength(1);
    expect(library.profiles).toHaveLength(0);

    const p0b: SourceProfile = { sourceId: "src-0", subjects: ["b"], concepts: [] };
    const merged2 = mergeLibraryProfiles(merged, [p0b]);
    expect(merged2.profiles).toHaveLength(1);
    expect(merged2.profiles[0].subjects).toEqual(["b"]);
  });

  it("selectUnprofiled ne renvoie que les sources sans profil", () => {
    const profiles: SourceProfile[] = [{ sourceId: "src-0", subjects: [], concepts: [] }];
    const remaining = selectUnprofiled(sources, profiles);
    expect(remaining.map((s) => s.id)).toEqual(["src-1", "src-2", "src-3", "src-4"]);
  });
});