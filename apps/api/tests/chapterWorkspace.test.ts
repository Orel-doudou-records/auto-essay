import { createDraftUnit } from "@auto-essay/core";
import { describe, expect, it } from "vitest";
import { mutateWorkspace } from "../src/services/editorialWorkspaceStore.js";
import { setSources } from "../src/services/sourceStore.js";
import { setUnits } from "../src/services/unitStore.js";
import { makeTempDataDir, makeTestApp, postJson } from "./helper";

const now = "2026-08-27T10:00:00.000Z";

async function createChapterWorkspace() {
  let modelFactoryCalls = 0;
  const app = makeTestApp(makeTempDataDir(), {
    modelClientFactory: async () => {
      modelFactoryCalls += 1;
      return {
        complete: async () => "{}",
        completeStream: async () => undefined,
      };
    },
  });
  const projectResponse = await postJson(app, "/api/projects", { title: "Projet chapitre P2" });
  const { project } = (await projectResponse.json()) as { project: { id: string } };
  const projectId = project.id;

  await app.request(`/api/projects/${projectId}/editorial/workspace`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      manuscript: {
        id: "manuscript-p2",
        projectId,
        title: "Manuscrit P2",
        createdAt: now,
        updatedAt: now,
        tree: [
          {
            kind: "node",
            id: "chapter-1",
            title: "Chapitre premier",
            children: [
              {
                kind: "node",
                id: "section-1",
                title: "Première section",
                children: [{ kind: "leaf", unitId: "unit-mounted", version: 1 }],
              },
              {
                kind: "node",
                id: "section-2",
                title: "Seconde section",
                children: [],
              },
            ],
          },
        ],
      },
      distribution: [
        { sourceId: "source-qualified", scopeId: "section-1", rationale: "archive distribuée", confidence: 0.9 },
        { sourceId: "source-visible", scopeId: "section-1", rationale: "piste visible", confidence: 0.5 },
      ],
      profiles: [
        { sourceId: "source-qualified", subjects: ["mémoire"], concepts: ["archive"] },
        { sourceId: "source-visible", subjects: ["mémoire"], concepts: [] },
      ],
      articulations: [
        articulation(projectId, "proposal-section-1", "section-1"),
        articulation(projectId, "proposal-revoked", "section-1"),
      ],
    }),
  });
  await setSources(projectId, [
    {
      id: "source-qualified",
      projectId,
      type: "note",
      title: "Archive qualifiée",
      content: "Extrait qualifié pour le chapitre.",
      authors: ["A. Auteur"],
      annotations: [],
      epistemicLimits: [],
      tags: [],
      verificationStatus: "verified",
    },
    {
      id: "source-visible",
      projectId,
      type: "note",
      title: "Piste sans extrait",
      content: "",
      authors: [],
      annotations: [],
      epistemicLimits: [],
      tags: [],
      verificationStatus: "unverified",
    },
  ]);
  await setUnits(projectId, [
    {
      ...createDraftUnit({
      projectId,
      granularity: "paragraph",
      version: 1,
      status: "verified",
      content: "Contenu monté.",
      contextInPlan: { section: "section-1" },
      evidencePack: { sourceIds: [] },
      }),
      id: "unit-mounted",
    },
    {
      ...createDraftUnit({
      projectId,
      granularity: "paragraph",
      content: "",
      contextInPlan: { section: "section-1" },
      evidencePack: { sourceIds: ["source-qualified"] },
      appliedDecisionIds: ["decision-section-1"],
      appliedArticulationIds: ["proposal-section-1"],
      }),
      id: "unit-prepared",
    },
  ]);

  const accepted = await postJson(
    app,
    `/api/projects/${projectId}/editorial/proposals/proposal-section-1/accept`,
    { contentCommitments: ["Conserver la tension"], formalCommitments: ["Ralentir le rythme"] }
  );
  const { decision } = (await accepted.json()) as { decision: { id: string } };
  const revocable = await postJson(
    app,
    `/api/projects/${projectId}/editorial/proposals/proposal-revoked/accept`,
    { contentCommitments: ["Écarter ensuite"], formalCommitments: ["Écarter ensuite"] }
  );
  const { decision: revokedDecision } = (await revocable.json()) as { decision: { id: string } };
  await mutateWorkspace(projectId, (workspace) => {
    const stored = workspace.decisions.find((item) => item.id === revokedDecision.id);
    if (!stored) throw new Error("expected revoked decision fixture");
    stored.status = "revoked";
    stored.updatedAt = now;
  });

  return { app, projectId, decisionId: decision.id, modelFactoryCalls: () => modelFactoryCalls };
}

function articulation(projectId: string, id: string, sectionId: string) {
  return {
    id,
    scope: { projectId, level: "section" as const, sectionId },
    contentRelationIds: ["relation-1"],
    supportingObservationIds: [],
    stylisticOperations: [
      {
        family: "enunciation_structure" as const,
        category: "section_progression" as const,
        operation: "Conserver une progression située.",
        target: "section" as const,
        rationale: "Maintenir la cohérence du chapitre.",
        intensity: "moderate" as const,
      },
    ],
    intendedEffects: { content: ["Clarifier l’enjeu"], form: ["Ralentir la transition"] },
    risks: [],
    alternatives: [],
    origin: "system_proposed" as const,
    status: "candidate" as const,
    createdAt: now,
    updatedAt: now,
  };
}

describe("chapter workspace routes", () => {
  it("returns an ordered chapter board with explicit transitions and no model call", async () => {
    const { app, projectId, decisionId, modelFactoryCalls } = await createChapterWorkspace();

    const response = await app.request(
      `/api/projects/${projectId}/editorial/chapters/chapter-1/workspace`
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      chapter: { id: "chapter-1", title: "Chapitre premier" },
      sections: [
        {
          id: "section-1",
          order: 1,
          decisions: [{ id: decisionId }],
          sources: [
            { sourceId: "source-qualified", availability: "evidence_pack" },
            { sourceId: "source-visible", availability: "visible_only", exclusionReason: "missing_excerpt" },
          ],
          transitions: {
            workshop: { sectionId: "section-1", href: `/projects/${projectId}/atelier?sectionId=section-1` },
            preparedUnits: [{ unitId: "unit-prepared", href: `/projects/${projectId}/editor?unitId=unit-prepared` }],
          },
        },
        {
          id: "section-2",
          order: 2,
          decisions: [],
          units: [],
          sources: [],
          transitions: {
            workshop: { sectionId: "section-2", href: `/projects/${projectId}/atelier?sectionId=section-2` },
            preparedUnits: [],
          },
        },
      ],
    });
    expect(modelFactoryCalls()).toBe(0);
  });

  it("returns an explicit error for a chapter that is absent from the manuscript", async () => {
    const { app, projectId } = await createChapterWorkspace();

    const response = await app.request(
      `/api/projects/${projectId}/editorial/chapters/missing/workspace`
    );

    expect(response.status).toBe(404);
  });
});
