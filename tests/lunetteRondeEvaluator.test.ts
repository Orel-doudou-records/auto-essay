import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_JUDGE_ROUTING_POLICY,
  EssayEvaluator,
  buildEssayLunetteRondePrompt,
  createDraftUnit,
  selectJudgeAssignment,
  type StructuredModelClient,
} from "../src/index";

describe("Lunette Ronde evaluator", () => {
  it("reviews through the read-only essay harness without entering the verdict", async () => {
    const unit = createDraftUnit({
      projectId: "essay-1",
      granularity: "paragraph",
    });
    unit.content =
      "Il est important de noter que cette évolution est significative. Cette décision était inévitable. La citation reste précise.";

    const client: StructuredModelClient = {
      generateJson: vi.fn(async () => ({
        mode: "full",
        findings: [
          {
            kind: "cut",
            evidence: { excerpt: "Il est important de noter que" },
            diagnosis: "L'amorce retarde l'assertion sans ajouter de prudence réelle.",
            suggestion: "Commencer directement par l'assertion.",
          },
          {
            kind: "open_question",
            evidence: { excerpt: "Cette décision était inévitable." },
            diagnosis: "La nécessité est affirmée sans cause explicite.",
            authorQuestion: "Quelle contrainte rend cette décision inévitable ?",
          },
          {
            kind: "keep",
            evidence: { excerpt: "La citation reste précise." },
            diagnosis: "La phrase est nette et ne demande aucune intervention.",
          },
        ],
      })),
    };

    const context = { unit, sources: [], claims: [] };
    const before = structuredClone(unit);
    const review = await new EssayEvaluator(client).reviewLunetteRonde(
      context,
      "full"
    );

    expect(review.findings.map((finding) => finding.kind)).toEqual([
      "cut",
      "open_question",
      "keep",
    ]);
    expect(unit).toEqual(before);

    const prompt = vi.mocked(client.generateJson).mock.calls[0][0];
    expect(prompt).toContain("intervention minimale vient après la compréhension");
    expect(prompt).toContain("degré de certitude");
    expect(prompt).toContain("citations");
    expect(prompt).toContain("n'invente ni fait, ni source, ni intention");
    expect(prompt).toContain("origine humaine ou IA");

    expect(
      selectJudgeAssignment(
        DEFAULT_JUDGE_ROUTING_POLICY,
        "lunette_ronde_review"
      )
    ).toMatchObject({
      workType: "lunette_ronde_review",
      judge: {
        id: "judge-editorial",
        role: "judge",
        specialty: "lunette_ronde_review",
      },
    });

    const badClient: StructuredModelClient = {
      generateJson: vi.fn(async () => ({
        mode: "full",
        findings: [
          {
            kind: "clarify",
            evidence: { excerpt: "Texte inventé absent de l'unité." },
            diagnosis: "Constat non ancré.",
            suggestion: "Réécrire.",
          },
        ],
      })),
    };

    await expect(
      new EssayEvaluator(badClient).reviewLunetteRonde(context)
    ).rejects.toThrow(/evidence is absent/);

    expect(buildEssayLunetteRondePrompt(unit, "ultra")).toContain("Mode ultra");
  });
});
