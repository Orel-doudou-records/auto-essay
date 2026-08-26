import { describe, expect, it } from "vitest";
import { mutateWorkspace } from "../src/services/editorialWorkspaceStore.js";
import { setSources } from "../src/services/sourceStore.js";
import { makeTempDataDir, makeTestApp, postJson } from "./helper";

const now = "2026-08-26T12:00:00.000Z";

function makeReadingJson(): string {
  return JSON.stringify({
    id: "reading-model",
    fragment: { statement: "Fragment diffracté", claimIds: [], sourceIds: [] },
    pass1: { refraction: [] },
    pass2: { namedPatterns: [], revealedDefaults: [] },
    pass3: { entanglements: [] },
    pass4: { cut: "Conserver la tension", included: [], excluded: [], cutOfNonAdoption: [] },
    verdict: "integrate_now",
    verdictDetail: "Le fragment rend le plan plus cohérent.",
    action: "Intégrer avec une transition.",
    tradeoffs: [],
    planImpacts: [],
    bibliographyImpacts: [],
    createdAt: now,
  });
}

function modelClientFactory() {
  return async () => ({
    complete: async () => makeReadingJson(),
    completeStream: async () => undefined,
  });
}

async function createWorkspace() {
  const app = makeTestApp(makeTempDataDir(), { modelClientFactory: modelClientFactory() });
  const projectResponse = await postJson(app, "/api/projects", { title: "Projet P1" });
  const created = (await projectResponse.json()) as { project: { id: string } };
  const projectId = created.project.id;

  const workspaceResponse = await app.request(`/api/projects/${projectId}/editorial/workspace`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      manuscript: {
        id: "manuscript-p1",
        projectId,
        title: "Livre P1",
        createdAt: now,
        updatedAt: now,
        tree: [
          {
            kind: "node",
            id: "section-1",
            title: "Section réelle",
            text: "Texte privé de la section.",
            plan: [{ id: "plan-1", subject: "Déplacer le fragment", notes: [] }],
            children: [],
          },
        ],
      },
      distribution: [
        { sourceId: "source-qualified", scopeId: "section-1", rationale: "source distribuée", confidence: 0.9 },
        { sourceId: "source-unqualified", scopeId: "section-1", rationale: "piste distribuée", confidence: 0.5 },
        { sourceId: "source-empty-profile", scopeId: "section-1", rationale: "profil vide", confidence: 0.4 },
        { sourceId: "source-empty-excerpt", scopeId: "section-1", rationale: "extrait absent", confidence: 0.4 },
      ],
      profiles: [
        { sourceId: "source-qualified", subjects: ["mémoire"], concepts: ["archive"], abstract: "Un extrait qualifié pour la section." },
        { sourceId: "source-empty-profile", subjects: [], concepts: [] },
        { sourceId: "source-empty-excerpt", subjects: ["mémoire"], concepts: [] },
      ],
      articulations: [
        {
          id: "proposal-1",
          scope: { projectId, level: "section", sectionId: "section-1" },
          contentRelationIds: ["relation-1"],
          supportingObservationIds: [],
          stylisticOperations: [
            {
              family: "enunciation_structure",
              category: "narrator_voice",
              operation: "Déplacer la voix narrative.",
              target: "section",
              rationale: "Maintenir la continuité argumentative.",
              intensity: "moderate",
            },
          ],
          intendedEffects: { content: ["Clarifier l’enjeu"], form: ["Ralentir la transition"] },
          risks: [],
          alternatives: [],
          origin: "system_proposed",
          status: "candidate",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "proposal-2",
          scope: { projectId, level: "section", sectionId: "section-1" },
          contentRelationIds: ["relation-2"],
          supportingObservationIds: [],
          stylisticOperations: [
            {
              family: "tone_lexicon",
              category: "conceptual_lexicon",
              operation: "Réduire les abstractions.",
              target: "section",
              rationale: "Rendre le fragment plus net.",
              intensity: "subtle",
            },
          ],
          intendedEffects: { content: ["Préciser le propos"], form: ["Épurer le lexique"] },
          risks: [],
          alternatives: [],
          origin: "system_proposed",
          status: "candidate",
          createdAt: now,
          updatedAt: now,
        },
      ],
    }),
  });
  expect(workspaceResponse.status).toBe(200);
  return { app, projectId };
}

describe("editorial workspace routes", () => {
  it("returns a compact section context and stores a non-executable reading", async () => {
    const { app, projectId } = await createWorkspace();

    const context = await app.request(`/api/projects/${projectId}/editorial/sections/section-1/context`);
    expect(context.status).toBe(200);
    const contextBody = (await context.json()) as {
      section: { id: string };
      bookParts: Array<Record<string, unknown>>;
      proposals: Array<{ id: string; status: string }>;
    };
    expect(contextBody.section.id).toBe("section-1");
    expect(contextBody.bookParts[0]).not.toHaveProperty("text");
    expect(contextBody.proposals).toMatchObject([
      { id: "proposal-1", status: "candidate", contentCommitments: ["Clarifier l’enjeu"] },
      { id: "proposal-2", status: "candidate", formalCommitments: ["Épurer le lexique"] },
    ]);

    const reading = await postJson(
      app,
      `/api/projects/${projectId}/editorial/sections/section-1/readings`,
      { statement: "Fragment diffracté", articulationId: "proposal-1" }
    );
    expect(reading.status).toBe(200);
    await expect(reading.json()).resolves.toMatchObject({ executable: false });
  });

  it("prepares a traceable writing context with only active decisions and qualified evidence", async () => {
    const { app, projectId } = await createWorkspace();
    await setSources(projectId, [
      {
        id: "source-qualified",
        projectId,
        type: "note",
        title: "Archive qualifiée",
        content: "Extrait qualifié utilisable comme preuve dans la rédaction.",
        authors: ["A. Auteur"],
        annotations: [],
        epistemicLimits: [],
        tags: [],
        verificationStatus: "verified",
      },
      {
        id: "source-empty-excerpt",
        projectId,
        type: "note",
        title: "Extrait absent",
        content: "",
        authors: [],
        annotations: [],
        epistemicLimits: [],
        tags: [],
        verificationStatus: "verified",
      },
      {
        id: "source-empty-profile",
        projectId,
        type: "note",
        title: "Profil sans qualification",
        content: "Texte disponible, mais profil dépourvu de qualification.",
        authors: [],
        annotations: [],
        epistemicLimits: [],
        tags: [],
        verificationStatus: "verified",
      },
      {
        id: "source-unqualified",
        projectId,
        type: "note",
        title: "Piste non qualifiée",
        content: "Texte visible mais sans profil associé.",
        authors: [],
        annotations: [],
        epistemicLimits: [],
        tags: [],
        verificationStatus: "unverified",
      },
    ]);

    const modified = await postJson(
      app,
      `/api/projects/${projectId}/editorial/proposals/proposal-1/modify`,
      {
        contentCommitments: ["Conserver la tension"],
        formalCommitments: ["Ralentir le rythme"],
        invariants: ["Préserver la voix située"],
        prohibitedShortcuts: ["Ne pas réduire la source à une preuve neutre"],
        validationNote: "Je prépare cette décision pour la rédaction.",
      }
    );
    const { decision } = (await modified.json()) as { decision: { id: string } };

    const prepared = await app.request(
      `/api/projects/${projectId}/editorial/sections/section-1/writing-context?decisionId=${decision.id}`
    );
    expect(prepared.status).toBe(200);
    const preparedBody = (await prepared.json()) as {
      decision: { id: string; validation: { validatedBy: string } };
      evidencePack: { sourceIds: string[]; keyCitations: Array<{ sourceId: string; quote: string }> };
      visibleSources: Array<{ sourceId: string; qualified: boolean; inclusion: string }>;
    };
    expect(preparedBody.decision).toMatchObject({ id: decision.id, validation: { validatedBy: "author" } });
    expect(preparedBody.evidencePack.sourceIds).toEqual(["source-qualified"]);
    expect(preparedBody.evidencePack.keyCitations).toEqual([
      {
        sourceId: "source-qualified",
        quote: "Extrait qualifié utilisable comme preuve dans la rédaction.",
        context: "source distribuée",
      },
    ]);
    expect(preparedBody.visibleSources).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceId: "source-qualified", qualified: true, inclusion: "evidence_pack" }),
      expect.objectContaining({
        sourceId: "source-unqualified",
        qualified: false,
        inclusion: "visible_only",
        exclusionReason: "missing_or_unqualified_profile",
      }),
      expect.objectContaining({
        sourceId: "source-empty-profile",
        qualified: false,
        inclusion: "visible_only",
        exclusionReason: "missing_or_unqualified_profile",
      }),
      expect.objectContaining({
        sourceId: "source-empty-excerpt",
        qualified: false,
        inclusion: "visible_only",
        exclusionReason: "missing_excerpt",
      }),
    ]));

    const created = await postJson(
      app,
      `/api/projects/${projectId}/editorial/sections/section-1/draft-units`,
      { decisionId: decision.id, targetWordCount: 180 }
    );
    expect(created.status).toBe(201);
    await expect(created.json()).resolves.toMatchObject({
      unit: {
        content: "",
        targetWordCount: 180,
        evidencePack: { sourceIds: ["source-qualified"] },
        appliedDecisionIds: [decision.id],
        appliedArticulationIds: ["proposal-1"],
      },
      generated: false,
    });

    const candidate = await app.request(
      `/api/projects/${projectId}/editorial/sections/section-1/writing-context?decisionId=proposal-2`
    );
    expect(candidate.status).toBe(404);

    await mutateWorkspace(projectId, (workspace) => {
      const activeDecision = workspace.decisions.find((item) => item.id === decision.id);
      if (!activeDecision) throw new Error("expected active decision fixture");
      activeDecision.status = "revoked";
      activeDecision.updatedAt = now;
    });
    const revoked = await app.request(
      `/api/projects/${projectId}/editorial/sections/section-1/writing-context?decisionId=${decision.id}`
    );
    expect(revoked.status).toBe(404);
  });

  it("requires an author note for adaptation and archives a rejection without an active cut", async () => {
    const { app, projectId } = await createWorkspace();

    const invalidModify = await postJson(
      app,
      `/api/projects/${projectId}/editorial/proposals/proposal-1/modify`,
      { contentCommitments: ["Adapter le contenu"], formalCommitments: ["Adapter la forme"] }
    );
    expect(invalidModify.status).toBe(400);

    const modified = await postJson(
      app,
      `/api/projects/${projectId}/editorial/proposals/proposal-1/modify`,
      {
        contentCommitments: ["Conserver la tension"],
        formalCommitments: ["Ralentir le rythme"],
        validationNote: "Je garde la proposition, mais je change sa mise en forme.",
      }
    );
    expect(modified.status).toBe(201);
    await expect(modified.json()).resolves.toMatchObject({
      decision: { status: "active", validation: { validatedBy: "author" } },
      event: { action: "modified" },
    });

    const rejected = await postJson(
      app,
      `/api/projects/${projectId}/editorial/proposals/proposal-2/reject`,
      { note: "Piste conservée pour plus tard." }
    );
    expect(rejected.status).toBe(200);
    await expect(rejected.json()).resolves.toMatchObject({ proposal: { status: "rejected" } });

    const context = await app.request(`/api/projects/${projectId}/editorial/sections/section-1/context`);
    const body = (await context.json()) as { decisions: Array<{ status: string }>; existingCuts: unknown[] };
    expect(body.decisions).toHaveLength(1);
    expect(body.decisions[0]?.status).toBe("active");
    expect(body.existingCuts).toHaveLength(1);
  });
});
