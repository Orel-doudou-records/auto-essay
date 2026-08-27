import {
  JudgeWorkTypeSchema,
  selectJudgeAssignment,
  type JudgeRoutingPolicy,
} from "../src/index";

const policy: JudgeRoutingPolicy = {
  judges: [
    {
      id: "judge-documentary",
      role: "judge",
      model: "documentary-judge-model",
      specialties: ["documentary_evaluation"],
    },
    {
      id: "judge-editorial",
      role: "judge",
      model: "editorial-judge-model",
      specialties: ["editorial_effect_evaluation"],
    },
  ],
};

describe("judge routing policy", () => {
  it("selects the single compatible judge with traceable work provenance", () => {
    const before = structuredClone(policy);

    expect(selectJudgeAssignment(policy, "documentary_evaluation")).toEqual({
      workType: "documentary_evaluation",
      judge: {
        id: "judge-documentary",
        role: "judge",
        model: "documentary-judge-model",
        specialty: "documentary_evaluation",
      },
      rationale: "specialty_matches_work_type",
    });
    expect(policy).toEqual(before);
  });

  it("refuses unknown work types, writers, missing compatibility and ambiguous policies", () => {
    expect(() => JudgeWorkTypeSchema.parse("writer_review")).toThrow();
    expect(() =>
      selectJudgeAssignment(
        {
          judges: [{ id: "writer-1", role: "writer", model: "writer-model", specialties: ["documentary_evaluation"] }],
        },
        "documentary_evaluation"
      )
    ).toThrow("no compatible judge");
    expect(() =>
      selectJudgeAssignment(
        {
          judges: [
            policy.judges[0],
            { ...policy.judges[0], id: "judge-documentary-2" },
          ],
        },
        "documentary_evaluation"
      )
    ).toThrow("ambiguous judge routing");
  });
});
