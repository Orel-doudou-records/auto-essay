import { describe, expect, it } from "vitest";
import {
  applyApprovedPlanningDiff,
  approveAllPlanningChanges,
  approveSelectedPlanningChanges,
  createManuscript,
  createManuscriptNode,
  createPlanningBrief,
  rejectAllPlanningChanges,
  type PlanningStructuralDiff,
} from "../src/index.js";

function fixture() {
  const chapterA = createManuscriptNode({ id: "a", title: "A" });
  const chapterB = createManuscriptNode({ id: "b", title: "B" });
  const manuscript = createManuscript({
    projectId: "project-1",
    title: "Essay",
    tree: [chapterA, chapterB],
  });
  const brief = createPlanningBrief({
    manuscript,
    scopeRef: {
      kind: "manuscript",
      projectId: manuscript.projectId,
      manuscriptId: manuscript.id,
    },
    question: "How should the book be structured?",
  });
  return { manuscript, brief };
}

describe("planning structural diff", () => {
  it("applies accept-all atomically while preserving untouched identity/order", () => {
    const { manuscript, brief } = fixture();
    const diff: PlanningStructuralDiff = {
      changes: [
        { id: "rename", kind: "rename_node", nodeId: "a", title: "A revised", reason: "clarify", consequences: [] },
        { id: "create", kind: "create_node", parentNodeId: null, index: 2, node: { id: "c", title: "C" }, reason: "missing articulation", consequences: [] },
      ],
    };

    const result = applyApprovedPlanningDiff({ manuscript, briefs: [brief], approvedDiff: approveAllPlanningChanges(diff) });
    expect(result.manuscript.tree.map((node) => node.kind === "node" ? [node.id, node.title] : [])).toEqual([
      ["a", "A revised"], ["b", "B"], ["c", "C"],
    ]);
    expect(manuscript.tree[0]).toMatchObject({ kind: "node", id: "a", title: "A" });
  });

  it("reject-all performs no canonical change", () => {
    const { manuscript, brief } = fixture();
    const result = applyApprovedPlanningDiff({ manuscript, briefs: [brief], approvedDiff: rejectAllPlanningChanges() });
    expect(result.manuscript).toBe(manuscript);
    expect(result.appliedChangeIds).toEqual([]);
  });

  it("applies exactly the selected and edited subset", () => {
    const { manuscript, brief } = fixture();
    const diff: PlanningStructuralDiff = {
      changes: [
        { id: "rename-a", kind: "rename_node", nodeId: "a", title: "A draft", reason: "clarify", consequences: [] },
        { id: "rename-b", kind: "rename_node", nodeId: "b", title: "B changed", reason: "clarify", consequences: [] },
      ],
    };
    const approved = approveSelectedPlanningChanges(diff, ["rename-a"], {
      "rename-a": { ...diff.changes[0]!, title: "A author edit" } as never,
    });
    const result = applyApprovedPlanningDiff({ manuscript, briefs: [brief], approvedDiff: approved });
    expect(result.manuscript.tree[0]).toMatchObject({ id: "a", title: "A author edit" });
    expect(result.manuscript.tree[1]).toMatchObject({ id: "b", title: "B" });
    expect(result.appliedChangeIds).toEqual(["rename-a"]);
  });

  it("fails the whole batch without mutating the input when a later change conflicts", () => {
    const { manuscript, brief } = fixture();
    const original = JSON.stringify(manuscript);
    const diff: PlanningStructuralDiff = {
      changes: [
        { id: "rename", kind: "rename_node", nodeId: "a", title: "A revised", reason: "clarify", consequences: [] },
        { id: "bad", kind: "move_node", nodeId: "missing", parentNodeId: null, index: 0, reason: "bad ref", consequences: [] },
      ],
    };
    expect(() => applyApprovedPlanningDiff({ manuscript, briefs: [brief], approvedDiff: approveAllPlanningChanges(diff) })).toThrow("Unknown manuscript node");
    expect(JSON.stringify(manuscript)).toBe(original);
  });

  it("keeps documentary absence explicit in an unresolved branch", () => {
    const { manuscript, brief } = fixture();
    const diff: PlanningStructuralDiff = {
      changes: [{
        id: "gap",
        kind: "add_unresolved_branch",
        parentNodeId: null,
        index: 2,
        node: { id: "gap-node", title: "Counter-archive testimony" },
        missingEvidence: "primary testimony",
        reason: "evidence is missing",
        consequences: ["cannot stabilize the claim"],
      }],
    };
    const result = applyApprovedPlanningDiff({ manuscript, briefs: [brief], approvedDiff: approveAllPlanningChanges(diff) });
    const node = result.manuscript.tree[2];
    expect(node).toMatchObject({ kind: "node", id: "gap-node" });
    if (node?.kind === "node") expect(node.notes?.[0]?.text).toContain("primary testimony");
  });

  it("supports split, merge, move and brief supersession through one approved batch", () => {
    const { manuscript, brief } = fixture();
    const diff: PlanningStructuralDiff = {
      changes: [
        { id: "split", kind: "split_node", nodeId: "a", replacements: [{ id: "a1", title: "A1" }, { id: "a2", title: "A2" }], reason: "separate functions", consequences: [] },
        { id: "merge", kind: "merge_nodes", nodeIds: ["a1", "a2"], mergedNode: { id: "am", title: "A merged" }, reason: "author chose synthesis", consequences: [] },
        { id: "move", kind: "move_node", nodeId: "b", parentNodeId: "am", index: 0, reason: "nest evidence", consequences: [] },
        { id: "brief", kind: "update_brief", briefId: brief.id, changes: { question: "Revised planning question" }, reason: "structure changed", consequences: [] },
      ],
    };
    const result = applyApprovedPlanningDiff({ manuscript, briefs: [brief], approvedDiff: approveAllPlanningChanges(diff) });
    expect(result.manuscript.tree).toHaveLength(1);
    expect(result.manuscript.tree[0]).toMatchObject({ kind: "node", id: "am", title: "A merged" });
    const root = result.manuscript.tree[0];
    if (root?.kind === "node") expect(root.children[0]).toMatchObject({ kind: "node", id: "b" });
    expect(result.briefs[0]?.version).toBe(2);
    expect(result.briefs[0]?.question).toBe("Revised planning question");
  });
});
