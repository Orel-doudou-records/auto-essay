import { describe, expect, it } from "vitest";
import { mutateWorkspace } from "../src/services/editorialWorkspaceStore.js";
import { setSources } from "../src/services/sourceStore.js";
import { updateUnit } from "../src/services/unitStore.js";
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

async function createWorkspace(
  factory: ReturnType<typeof modelClientFactory> = modelClientFactory()
) {
  const app = makeTestApp(makeTempDataDir(), { modelClientFactory: factory });
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
    const createdBody = (await created.json()) as { unit: { id: string } };
    expect(createdBody).toMatchObject({
      unit: {
        content: "",
        targetWordCount: 180,
        evidencePack: { sourceIds: ["source-qualified"] },
        appliedDecisionIds: [decision.id],
        appliedArticulationIds: ["proposal-1"],
      },
      generated: false,
    });

    const readiness = await app.request(
      `/api/projects/${projectId}/units/${createdBody.unit.id}/evaluate/readiness`
    );
    expect(readiness.status).toBe(200);
    await expect(readiness.json()).resolves.toMatchObject({
      status: "unavailable",
      reasons: [{ code: "missing_compatible_traces" }],
      context: {
        unitId: createdBody.unit.id,
        unitVersion: 2,
        decisionIds: [decision.id],
        evaluatorProjection: {
          unitId: createdBody.unit.id,
          decisionIds: [decision.id],
        },
        transformationTraces: [],
      },
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

    const revokedReadiness = await app.request(
      `/api/projects/${projectId}/units/${createdBody.unit.id}/evaluate/readiness`
    );
    expect(revokedReadiness.status).toBe(200);
    await expect(revokedReadiness.json()).resolves.toEqual({
      status: "unavailable",
      reasons: [{ code: "missing_active_decision" }],
    });
  });

  it("becomes ready only after an explicit editorial generation declares a compatible writer trace", async () => {
    const appFactory = async () => ({
      complete: async (_system: string, user: string) => {
        if (!user.includes("Tu travailles en mode PARAGRAPHE")) return makeReadingJson();
        const directive = user.match(/- \[([^\]]+)\][\s\S]*?decision=([^;]+); articulation=([^\n]+)/);
        if (!directive) throw new Error("expected writer directive in generation prompt");
        const paragraph = "La transition est ralentie pour distinguer les archives sans les réduire.";
        return JSON.stringify({
          plan_3_sentences: ["Première.", "Deuxième.", "Troisième."],
          paragraph,
          claims: [],
          confidence_assessment: "medium",
          applied_directives: [
            {
              directiveId: directive[1],
              decisionId: directive[2],
              articulationId: directive[3],
              declaration: "La transition est ralentie.",
              excerpt: "La transition est ralentie",
            },
          ],
        });
      },
      completeStream: async () => undefined,
    });
    const { app, projectId } = await createWorkspace(appFactory);
    const modified = await postJson(
      app,
      `/api/projects/${projectId}/editorial/proposals/proposal-1/modify`,
      {
        contentCommitments: ["Conserver la tension"],
        formalCommitments: ["Ralentir le rythme"],
        validationNote: "Je prépare cette décision pour une évaluation intégrée.",
      }
    );
    const { decision } = (await modified.json()) as { decision: { id: string } };
    const created = await postJson(
      app,
      `/api/projects/${projectId}/editorial/sections/section-1/draft-units`,
      { decisionId: decision.id }
    );
    const { unit } = (await created.json()) as { unit: { id: string } };

    const generated = await app.request(
      `/api/projects/${projectId}/units/${unit.id}/generate`,
      { method: "POST" }
    );
    expect(generated.status).toBe(200);

    const readiness = await app.request(
      `/api/projects/${projectId}/units/${unit.id}/evaluate/readiness`
    );
    expect(readiness.status).toBe(200);
    await expect(readiness.json()).resolves.toMatchObject({
      status: "ready",
      context: {
        unitId: unit.id,
        decisionIds: [decision.id],
        transformationTraces: [
          { decisionId: decision.id, declaration: "La transition est ralentie." },
        ],
      },
    });
  });

  it("runs the two assigned judges without letting editorial success override a documentary failure", async () => {
    const modelCalls: string[] = [];
    const appFactory = async () => ({
      complete: async (_system: string, user: string) => {
        modelCalls.push(user);
        if (user.includes("Tu travailles en mode PARAGRAPHE")) {
          const directive = user.match(/- \[([^\]]+)\][\s\S]*?decision=([^;]+); articulation=([^\n]+)/);
          if (!directive) throw new Error("expected writer directive in generation prompt");
          return JSON.stringify({
            plan_3_sentences: ["Première.", "Deuxième.", "Troisième."],
            paragraph: "La transition est ralentie pour distinguer les archives sans les réduire.",
            claims: [],
            confidence_assessment: "medium",
            applied_directives: [
              {
                directiveId: directive[1],
                decisionId: directive[2],
                articulationId: directive[3],
                declaration: "La transition est ralentie.",
                excerpt: "La transition est ralentie",
              },
            ],
          });
        }
        if (user.includes("évaluateur critique")) {
          return JSON.stringify({
            overallScore: 8,
            dimensions: {
              claimSupport: 5,
              citationIntegrity: 8,
              counterargumentQuality: 8,
              transitionClarity: 8,
              scopeControl: 8,
              voiceConsistency: 8,
            },
            weaknesses: [],
            strongClaims: [],
            weakClaims: [],
            aiPatternsDetected: [],
            overclaimRisks: [],
            top3Revisions: [],
            newClaimEntries: [],
            evidenceGaps: [],
            citationGaps: [],
            verdict: "keep",
          });
        }
        if (user.includes("juge éditorial indépendant")) {
          const criteria = user.match(/## Critères canoniques\n```json\n([\s\S]*?)\n```/);
          const traces = user.match(/## Déclarations du writer à vérifier\n```json\n([\s\S]*?)\n```/);
          if (!criteria || !traces) throw new Error("expected canonical editorial context");
          const [criterion] = JSON.parse(criteria[1]) as Array<{
            id: string;
            decisionId: string;
            articulationId: string;
            directiveIds: string[];
          }>;
          const [trace] = JSON.parse(traces[1]) as Array<{ id: string }>;
          return JSON.stringify({
            criterionResults: [
              {
                criterionId: criterion.id,
                decisionId: criterion.decisionId,
                articulationId: criterion.articulationId,
                directiveIds: criterion.directiveIds,
                traceIds: [trace.id],
                status: "effective",
                contentScore: 8,
                formScore: 8,
                contentFindings: ["La distinction reste visible."],
                formFindings: ["Le ralentissement est perceptible."],
                evidence: [{ excerpt: "La transition est ralentie" }],
                unintendedEffects: [],
              },
            ],
            contentFormCoherence: 8,
            overallEditorialScore: 8,
            summary: "Les effets attendus sont présents.",
          });
        }
        return makeReadingJson();
      },
      completeStream: async () => undefined,
    });
    const { app, projectId } = await createWorkspace(appFactory);
    const modified = await postJson(
      app,
      `/api/projects/${projectId}/editorial/proposals/proposal-1/modify`,
      {
        contentCommitments: ["Conserver la tension"],
        formalCommitments: ["Ralentir le rythme"],
        validationNote: "Je prépare cette décision pour les deux juges.",
      }
    );
    const { decision } = (await modified.json()) as { decision: { id: string } };
    const created = await postJson(
      app,
      `/api/projects/${projectId}/editorial/sections/section-1/draft-units`,
      { decisionId: decision.id }
    );
    const { unit } = (await created.json()) as { unit: { id: string } };
    await app.request(`/api/projects/${projectId}/units/${unit.id}/generate`, { method: "POST" });
    modelCalls.length = 0;

    const evaluated = await app.request(
      `/api/projects/${projectId}/units/${unit.id}/evaluate/integrated`,
      { method: "POST" }
    );

    expect(evaluated.status).toBe(200);
    await expect(evaluated.json()).resolves.toMatchObject({
      evaluation: { evaluatorModel: "judge-model" },
      editorialEvaluation: { evaluatorModel: "editorial-judge-model" },
      gates: { documentaryIntegrity: "fail", editorialCoherence: "pass" },
      finalVerdict: "revise",
      assignments: {
        documentary: { workType: "documentary_evaluation" },
        editorial: { workType: "editorial_effect_evaluation" },
      },
      brief: { targetUnitId: unit.id },
    });
    expect(modelCalls).toHaveLength(2);
    expect(modelCalls[0]).toContain("évaluateur critique");
    expect(modelCalls[1]).toContain("juge éditorial indépendant");

    const unitBeforeHistory = await app.request(
      `/api/projects/${projectId}/units/${unit.id}`
    );
    const sectionBeforeHistory = await app.request(
      `/api/projects/${projectId}/editorial/sections/section-1/context`
    );

    const history = await app.request(
      `/api/projects/${projectId}/units/${unit.id}/evaluate/integrated/history`
    );
    expect(history.status).toBe(200);
    await expect(history.json()).resolves.toMatchObject({
      history: [
        {
          unitId: unit.id,
          unitVersion: 2,
          evaluation: { evaluatorModel: "judge-model" },
          editorialEvaluation: { evaluatorModel: "editorial-judge-model" },
          gates: { documentaryIntegrity: "fail", editorialCoherence: "pass" },
          finalVerdict: "revise",
          brief: { targetUnitId: unit.id },
          assignments: {
            documentary: { workType: "documentary_evaluation" },
            editorial: { workType: "editorial_effect_evaluation" },
          },
          context: {
            unitId: unit.id,
            decisionIds: [decision.id],
            transformationTraces: [{ unitId: unit.id }],
          },
          authorDecisions: [{ id: decision.id, status: "active" }],
          current: true,
        },
      ],
    });
    expect(modelCalls).toHaveLength(2);
    const unitAfterHistory = await app.request(
      `/api/projects/${projectId}/units/${unit.id}`
    );
    const sectionAfterHistory = await app.request(
      `/api/projects/${projectId}/editorial/sections/section-1/context`
    );
    await expect(unitAfterHistory.json()).resolves.toEqual(await unitBeforeHistory.json());
    await expect(sectionAfterHistory.json()).resolves.toEqual(await sectionBeforeHistory.json());

    const revisedUnit = await updateUnit(projectId, unit.id, {
      content: "Texte explicitement modifié après le jugement.",
      version: 3,
    });
    expect(revisedUnit?.version).toBe(3);
    const historyAfterUnitChange = await app.request(
      `/api/projects/${projectId}/units/${unit.id}/evaluate/integrated/history`
    );
    await expect(historyAfterUnitChange.json()).resolves.toMatchObject({
      history: [{ unitVersion: 2, current: false }],
    });
    expect(modelCalls).toHaveLength(2);

    await updateUnit(projectId, unit.id, { version: 2 });
    await mutateWorkspace(projectId, (workspace) => {
      const recordedDecision = workspace.decisions.find((item) => item.id === decision.id);
      if (!recordedDecision) throw new Error("expected recorded decision fixture");
      recordedDecision.status = "revoked";
      recordedDecision.updatedAt = "2026-08-27T12:00:00.000Z";
    });
    const historyAfterDecisionChange = await app.request(
      `/api/projects/${projectId}/units/${unit.id}/evaluate/integrated/history`
    );
    await expect(historyAfterDecisionChange.json()).resolves.toMatchObject({
      history: [
        {
          current: false,
          authorDecisions: [{ id: decision.id, status: "active" }],
        },
      ],
    });
    expect(modelCalls).toHaveLength(2);
  });

  it("rejects stale or revoked prepared contexts before obtaining a model client", async () => {
    let modelFactoryCalls = 0;
    const appFactory = async () => {
      modelFactoryCalls += 1;
      return {
        complete: async () => makeReadingJson(),
        completeStream: async () => undefined,
      };
    };
    const { app, projectId } = await createWorkspace(appFactory);
    const modified = await postJson(
      app,
      `/api/projects/${projectId}/editorial/proposals/proposal-1/modify`,
      {
        contentCommitments: ["Conserver la tension"],
        formalCommitments: ["Ralentir le rythme"],
        validationNote: "Je prépare une unité avant contrôle intégré.",
      }
    );
    const { decision } = (await modified.json()) as { decision: { id: string } };
    const created = await postJson(
      app,
      `/api/projects/${projectId}/editorial/sections/section-1/draft-units`,
      { decisionId: decision.id }
    );
    const { unit } = (await created.json()) as { unit: { id: string } };
    const staleUnit = await updateUnit(projectId, unit.id, { version: 3 });
    expect(staleUnit?.version).toBe(3);

    const stale = await app.request(
      `/api/projects/${projectId}/units/${unit.id}/evaluate/integrated`,
      { method: "POST" }
    );
    expect(stale.status).toBe(400);
    await expect(stale.json()).resolves.toMatchObject({
      message: "integrated evaluation unavailable: context_mismatch",
    });

    const restoredUnit = await updateUnit(projectId, unit.id, { version: 1 });
    expect(restoredUnit?.version).toBe(1);

    await mutateWorkspace(projectId, (workspace) => {
      const activeDecision = workspace.decisions.find((item) => item.id === decision.id);
      if (!activeDecision) throw new Error("expected active decision fixture");
      activeDecision.status = "revoked";
      activeDecision.updatedAt = now;
    });
    const revoked = await app.request(
      `/api/projects/${projectId}/units/${unit.id}/evaluate/integrated`,
      { method: "POST" }
    );
    expect(revoked.status).toBe(400);
    await expect(revoked.json()).resolves.toMatchObject({
      message: "integrated evaluation unavailable: missing_active_decision",
    });
    expect(modelFactoryCalls).toBe(0);
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
