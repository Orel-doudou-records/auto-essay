import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

describe("Plan V2 architecture contracts", () => {
  it("keeps Manuscript.tree as the only structural authority and transient planning concepts out of persistence", async () => {
    const manuscript = await read("src/domain/manuscript.ts");
    const brief = await read("src/domain/planningBrief.ts");
    const workspace = await read("apps/api/src/services/editorialWorkspaceStore.ts");

    expect(manuscript).toContain("tree:");
    expect(workspace).toContain("planningBriefs");
    expect(workspace).not.toMatch(/planningSessions|planningReadiness|subjectCandidates|decompositionProposals|planningDiffs/);
    expect(brief).not.toMatch(/PlanningWorkspace|PlanningSession/);
  });

  it("keeps Plan V2 on the existing Diffract and EditorialPlan seams", async () => {
    const refinement = await read("src/editorial/planRefinement.ts");
    const impacts = await read("src/editorial/planningImpactReview.ts");
    const compiler = await read("src/editorial/planningEditorialPlanCompiler.ts");

    expect(refinement).toMatch(/diffractPlan|createDiffractiveReader/);
    expect(impacts).toContain("createDiffractiveReader");
    expect(compiler).toContain("createEditorialPlan");
    expect(compiler).not.toMatch(/PlanningEditorialPlanSchema|PlanningExecutionPlan/);
  });

  it("does not introduce AutoEssay planning primitives into the Writing Engine adapter", async () => {
    const adapter = await read("src/editorial/writingEngineCollaborativeCoreAdapter.ts");
    expect(adapter).not.toMatch(/PlanningBrief|PlanningWorkspace|PlanningSession|PlanningReadiness/);
  });
});
