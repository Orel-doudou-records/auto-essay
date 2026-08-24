import { describe, expect, it } from "vitest";
import { ManuscriptSchema } from "../src/domain";
import type { BookPlanInput } from "../src/editorial/diffractiveReader";
import {
  buildDraftPrompt,
  draftPlanEntry,
  findPlanEntry,
} from "../src/editorial/planDrafting";

const plan: BookPlanInput[] = [
  {
    partId: "chap-2",
    partTitle: "Chapitre 2 — Le salon",
    entries: [
      { id: "chap2-06", subject: "Transition : l'accident vers…", notes: [{ kind: "human", text: "sans pathos" }] },
      { id: "chap2-07", subject: "La photo de mon oncle" },
    ],
  },
];

describe("trace entrée → unité (domaine)", () => {
  it("accepte unitId+unitVersion ensemble", () => {
    const result = ManuscriptSchema.safeParse({
      id: "m1",
      projectId: "p1",
      title: "Essai",
      tree: [
        {
          kind: "node",
          id: "chap-2",
          title: "Chapitre 2",
          children: [],
          plan: [{ id: "e1", subject: "Le salon", unitId: "u1", unitVersion: 3 }],
        },
      ],
      createdAt: "2026-08-24T12:00:00.000Z",
      updatedAt: "2026-08-24T12:00:00.000Z",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const node = result.data.tree[0];
      if (node.kind === "node") {
        expect(node.plan?.[0].unitId).toBe("u1");
        expect(node.plan?.[0].unitVersion).toBe(3);
      }
    }
  });

  it("refuse unitId sans unitVersion", () => {
    const result = ManuscriptSchema.safeParse({
      id: "m1",
      projectId: "p1",
      title: "Essai",
      tree: [
        {
          kind: "node",
          id: "chap-2",
          title: "Chapitre 2",
          children: [],
          plan: [{ id: "e1", subject: "Le salon", unitId: "u1" }],
        },
      ],
      createdAt: "2026-08-24T12:00:00.000Z",
      updatedAt: "2026-08-24T12:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("findPlanEntry", () => {
  it("trouve une entrée par id", () => {
    const found = findPlanEntry(plan, "chap2-07");
    expect(found?.part.partId).toBe("chap-2");
    expect(found?.entry.subject).toBe("La photo de mon oncle");
  });

  it("renvoie undefined si introuvable", () => {
    expect(findPlanEntry(plan, "absent")).toBeUndefined();
  });
});

describe("buildDraftPrompt", () => {
  it("contient le chapitre, l'entrée, les notes et le format JSON", () => {
    const found = findPlanEntry(plan, "chap2-06");
    const prompt = buildDraftPrompt(found!.part, found!.entry);
    expect(prompt).toContain("Chapitre 2 — Le salon");
    expect(prompt).toContain("Transition : l'accident vers…");
    expect(prompt).toContain("note (humain) : sans pathos");
    expect(prompt).toContain('{"content": "le paragraphe rédigé"}');
  });
});

describe("draftPlanEntry", () => {
  it("rédige le paragraphe via le client structuré", async () => {
    const fake = {
      generateJson: async (): Promise<unknown> => ({
        content: "L'accident n'a rien dit, et tout le monde a compris.",
      }),
    };
    const content = await draftPlanEntry(plan, "chap2-07", fake);
    expect(content).toContain("L'accident");
  });

  it("refuse une entrée inconnue", async () => {
    await expect(draftPlanEntry(plan, "inconnue", { generateJson: async () => ({ content: "x" }) })).rejects.toThrow("not found");
  });

  it("refuse une entrée déjà écrite (trace unitId)", async () => {
    const writtenPlan: BookPlanInput[] = [
      {
        partId: "chap-2",
        partTitle: "Chapitre 2",
        entries: [{ id: "e1", subject: "Le salon", unitId: "u1", unitVersion: 1 }],
      },
    ];
    await expect(
      draftPlanEntry(writtenPlan, "e1", { generateJson: async () => ({ content: "x" }) })
    ).rejects.toThrow("already written");
  });
});