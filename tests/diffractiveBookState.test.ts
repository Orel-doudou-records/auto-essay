import { describe, it, expect } from "vitest";
import type { StructuredModelClient } from "../src/evaluation/evaluateEssay";
import type { BookPartInput, ExistingCutInput } from "../src/editorial/diffractiveReader";
import {
  assertBookPartsValid,
  buildDiffractivePrompt,
  createDiffractiveReader,
  formatBookPart,
  statusLabel,
} from "../src/editorial/diffractiveReader";
import { createDiffractiveBatchRunner } from "../src/editorial/diffractiveBatch";
import { createDiffractivePipeline } from "../src/editorial/diffractivePipeline";
import {
  buildDiffractiveRequest,
  extractBookParts,
  extractExistingCuts,
  parseDiffractArgs,
} from "../src/editorial/diffractCommand";

function validRawOutput() {
  return {
    pass1: { refraction: ["réfraction"] },
    pass2: { namedPatterns: [], revealedDefaults: [] },
    pass3: { entanglements: [] },
    pass4: {
      cut: "COUPE",
      included: [],
      excluded: [],
      cutOfNonAdoption: [],
    },
    verdict: "integrate_now",
    verdictDetail: "détail",
    action: "action",
    tradeoffs: [],
  };
}

function capturingClient(prompts: string[]): StructuredModelClient {
  return {
    async generateJson(prompt: string): Promise<unknown> {
      prompts.push(prompt);
      return validRawOutput();
    },
  };
}

const part: BookPartInput = {
  id: "c1",
  title: "Chapitre 1",
  status: "drafting",
  text: "Texte du chapitre 1.",
};

describe("état du livre en cours — libellés", () => {
  it("mappe chaque statut vers son libellé français", () => {
    expect(statusLabel("drafting")).toBe("ÉBAUCHE");
    expect(statusLabel("reviewing")).toBe("EN RÉVISION");
    expect(statusLabel("revising")).toBe("EN RÉÉCRITURE");
    expect(statusLabel("verified")).toBe("RÉDIGÉ (validé)");
    expect(statusLabel("published")).toBe("PUBLIÉ");
    expect(statusLabel("archived")).toBe("ARCHIVÉ");
  });

  it("formate une partie : statut, titre, id, texte", () => {
    expect(formatBookPart(part)).toContain("[ÉBAUCHE] Chapitre 1 (c1)");
    expect(formatBookPart(part)).toContain("Texte du chapitre 1.");
  });

  it("signale une partie planifiée sans texte", () => {
    expect(
      formatBookPart({ id: "c3", title: "Chapitre 3", status: "verified", text: "" })
    ).toContain("(pas encore écrit)");
  });
});

describe("état du livre en cours — prompt", () => {
  it("rend la section État avec les statuts quand bookParts est fourni", () => {
    const prompt = buildDiffractivePrompt({
      statement: "s",
      bookParts: [
        part,
        { id: "c2", title: "Chapitre 2", status: "verified", text: "" },
      ],
    });
    expect(prompt).toContain("## État du livre en cours");
    expect(prompt).toContain("[ÉBAUCHE] Chapitre 1 (c1)");
    expect(prompt).toContain("[RÉDIGÉ (validé)] Chapitre 2 (c2)");
    expect(prompt).toContain("(pas encore écrit)");
  });

  it("rend les coupes déjà édictées", () => {
    const cuts: ExistingCutInput[] = [
      {
        scope: "Acte I, chapitre 2",
        verdict: "integrate_now",
        cut: "La diaspora comme technologie.",
      },
    ];
    const prompt = buildDiffractivePrompt({ statement: "s", bookParts: [part], existingCuts: cuts });
    expect(prompt).toContain("Coupes déjà édictées");
    expect(prompt).toContain("Acte I, chapitre 2");
    expect(prompt).toContain("verdict integrate_now");
  });

  it("ne rend pas la section État en l'absence de bookParts et de coupes", () => {
    const prompt = buildDiffractivePrompt({ statement: "s", book: "Livre brut." });
    expect(prompt).not.toContain("## État du livre en cours");
  });
});

describe("état du livre en cours — validation", () => {
  it("rejette une liste vide", () => {
    expect(() => assertBookPartsValid([])).toThrow(/empty/);
  });

  it("rejette les identifiants dupliqués", () => {
    const duplicate = [part, { ...part, title: "Autre" }];
    expect(() => assertBookPartsValid(duplicate)).toThrow(/unique/);
  });

  it("rejette un statut inconnu", () => {
    const bad = [{ ...part, status: "nonsense" as BookPartInput["status"] }];
    expect(() => assertBookPartsValid(bad)).toThrow(/invalid status/);
  });
});

describe("état du livre en cours — lecture", () => {
  it("read() transmet bookParts dans le prompt et produit une lecture", async () => {
    const prompts: string[] = [];
    const reading = await createDiffractiveReader(capturingClient(prompts)).read({
      statement: "s",
      bookParts: [part],
    });
    expect(prompts[0]).toContain("## État du livre en cours");
    expect(reading.verdict).toBe("integrate_now");
  });

  it("le batch transmet bookParts au lecteur", async () => {
    const prompts: string[] = [];
    const runner = createDiffractiveBatchRunner(capturingClient(prompts));
    const result = await runner.run({
      fragments: [{ statement: "f1" }],
      bookParts: [part],
    });
    expect(result.failures).toEqual([]);
    expect(prompts[0]).toContain("## État du livre en cours");
  });

  it("le pipeline transmet bookParts au lecteur", async () => {
    const prompts: string[] = [];
    const pipeline = createDiffractivePipeline(capturingClient(prompts));
    await pipeline.diffract({ statement: "f1" }, { bookParts: [part] });
    expect(prompts[0]).toContain("## État du livre en cours");
  });
});

describe("état du livre en cours — commande", () => {
  it("parse les flags --book-parts et --cuts", () => {
    const args = parseDiffractArgs([
      "--statement",
      "s",
      "--book-parts",
      "bp.json",
      "--cuts",
      "cuts.json",
    ]);
    expect(args.bookPartsPath).toBe("bp.json");
    expect(args.cutsPath).toBe("cuts.json");
  });

  it("extrait les parties d'un JSON brut", () => {
    expect(
      extractBookParts([
        { id: "c1", title: "C1", status: "drafting", text: "t" },
        { label: "x" },
      ])
    ).toEqual([{ id: "c1", title: "C1", status: "drafting", text: "t" }]);
    expect(extractBookParts("nope")).toEqual([]);
  });

  it("extrait les coupes d'un JSON brut", () => {
    expect(
      extractExistingCuts([
        { scope: "s", verdict: "integrate_now", cut: "c" },
        { scope: "z" },
      ])
    ).toEqual([{ scope: "s", verdict: "integrate_now", cut: "c" }]);
  });

  it("buildDiffractiveRequest transmet bookParts et existingCuts", () => {
    const request = buildDiffractiveRequest({
      statement: "s",
      claimIds: [],
      sourceIds: [],
      bookParts: [part],
      existingCuts: [{ scope: "s", verdict: "integrate_now", cut: "c" }],
    });
    expect(request.bookParts).toEqual([part]);
    expect(request.existingCuts).toEqual([
      { scope: "s", verdict: "integrate_now", cut: "c" },
    ]);
  });
});