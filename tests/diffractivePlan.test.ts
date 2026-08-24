import { describe, expect, it } from "vitest";
import {
  createManuscript,
  createManuscriptNode,
  createPlanEntry,
  createPlanNote,
} from "../src/domain";
import {
  assertBookPlanValid,
  buildBookPlanSection,
  DiffractiveReader,
  formatPlanEntry,
  formatPlanPart,
  type BookPlanInput,
} from "../src/editorial/diffractiveReader";
import { projectBookPlan } from "../src/editorial/projectBookState";

describe("projectBookPlan", () => {
  it("projette les chapitres porteurs de plan, dans l'ordre de l'arbre", () => {
    const manuscript = createManuscript({
      projectId: "projet-1",
      title: "Judéofuturisme",
      tree: [
        createManuscriptNode({
          id: "chap-2",
          title: "Chapitre 2",
          plan: [
            createPlanEntry("Le salon", {
              preview: "La scène domestique.",
              notes: [createPlanNote("human", "garder le contraste")],
            }),
            createPlanEntry("Abikou et le rêve prémonitoire"),
          ],
        }),
        createManuscriptNode({ id: "chap-3", title: "Chapitre 3" }),
        createManuscriptNode({
          id: "chap-4",
          title: "Chapitre 4",
          plan: [createPlanEntry("Sun Ra et les pyramides")],
        }),
      ],
    });

    const plan = projectBookPlan(manuscript);

    expect(plan).toHaveLength(2);
    expect(plan[0].partId).toBe("chap-2");
    expect(plan[0].entries.map((e) => e.subject)).toEqual([
      "Le salon",
      "Abikou et le rêve prémonitoire",
    ]);
    expect(plan[0].entries[0].preview).toBe("La scène domestique.");
    expect(plan[0].entries[0].notes?.[0]).toEqual({
      kind: "human",
      text: "garder le contraste",
    });
    expect(plan[1].partId).toBe("chap-4");
  });

  it("ignore un nœud sans plan et un nœud à plan vide", () => {
    const manuscript = createManuscript({
      projectId: "projet-1",
      title: "Essai",
      tree: [
        createManuscriptNode({ id: "a", title: "Sans plan" }),
        createManuscriptNode({ id: "b", title: "Plan vide", plan: [] }),
        createManuscriptNode({
          id: "c",
          title: "Avec plan",
          plan: [createPlanEntry("x")],
        }),
      ],
    });

    expect(projectBookPlan(manuscript)).toHaveLength(1);
  });
});

describe("formatPlanEntry / formatPlanPart", () => {
  it("rend le sujet, l'aperçu et les notes", () => {
    const line = formatPlanEntry({
      id: "e1",
      subject: "Le salon",
      preview: "La scène domestique.",
      notes: [
        { kind: "human", text: "garder le contraste" },
        { kind: "agent", text: "résumé validé" },
      ],
    });
    expect(line).toContain("[e1] Le salon");
    expect(line).toContain("aperçu : La scène domestique.");
    expect(line).toContain("note (humain) : garder le contraste");
    expect(line).toContain("note (agent) : résumé validé");
  });

  it("formatPlanPart inclut le titre et les entrées", () => {
    const part: BookPlanInput = {
      partId: "chap-2",
      partTitle: "Chapitre 2",
      entries: [{ id: "e1", subject: "Le salon" }],
    };
    const rendered = formatPlanPart(part);
    expect(rendered).toContain("### Chapitre 2 (chap-2)");
    expect(rendered).toContain("[e1] Le salon");
  });
});

describe("buildBookPlanSection", () => {
  it("produit la section « Le plan du livre »", () => {
    const section = buildBookPlanSection([
      {
        partId: "chap-2",
        partTitle: "Chapitre 2",
        entries: [
          { id: "e1", subject: "Le salon", preview: "La scène domestique." },
        ],
      },
    ]);
    expect(section).toContain("## Le plan du livre");
    expect(section).toContain("Le salon");
    expect(section).toContain("plusieurs chapitres plus loin");
  });
});

describe("assertBookPlanValid", () => {
  const valid: BookPlanInput[] = [
    { partId: "p1", partTitle: "Chapitre 1", entries: [{ id: "e1", subject: "S" }] },
  ];

  it("accepte un plan valide", () => {
    expect(() => assertBookPlanValid(valid)).not.toThrow();
  });

  it("refuse un plan vide", () => {
    expect(() => assertBookPlanValid([])).toThrow("must not be empty");
  });

  it("refuse des partIds dupliqués", () => {
    expect(() =>
      assertBookPlanValid([
        ...valid,
        { partId: "p1", partTitle: "Autre", entries: [{ id: "e2", subject: "S" }] },
      ])
    ).toThrow("partIds must be unique");
  });

  it("refuse des ids d'entrées dupliqués dans une partie", () => {
    expect(() =>
      assertBookPlanValid([
        {
          partId: "p1",
          partTitle: "Chapitre 1",
          entries: [
            { id: "e1", subject: "A" },
            { id: "e1", subject: "B" },
          ],
        },
      ])
    ).toThrow("duplicated entry ids");
  });
});

describe("DiffractiveReader (bookPlan + planImpacts)", () => {
  it("injecte le plan dans le prompt et récupère les impacts", async () => {
    let capturedPrompt = "";
    const fakeClient = {
      generateJson: async (prompt: string): Promise<unknown> => {
        capturedPrompt = prompt;
        return {
          pass1: { refraction: ["r"] },
          pass2: { namedPatterns: [], revealedDefaults: [] },
          pass3: { entanglements: [] },
          pass4: { cut: "c", included: [], excluded: [], cutOfNonAdoption: [] },
          verdict: "integrate_now",
          verdictDetail: "pourquoi",
          action: "action",
          tradeoffs: [],
          planImpacts: [
            {
              partId: "chap-3",
              partTitle: "Chapitre 3",
              entryId: "e5",
              impact: "renforce la conclusion",
            },
          ],
        };
      },
    };

    const reading = await new DiffractiveReader(fakeClient).read({
      statement: "Le fragment.",
      bookPlan: [
        {
          partId: "chap-2",
          partTitle: "Chapitre 2",
          entries: [{ id: "e1", subject: "Le salon" }],
        },
      ],
    });

    expect(capturedPrompt).toContain("## Le plan du livre");
    expect(capturedPrompt).toContain("Le salon");
    expect(reading.planImpacts).toEqual([
      {
        partId: "chap-3",
        partTitle: "Chapitre 3",
        entryId: "e5",
        impact: "renforce la conclusion",
      },
    ]);
  });
});