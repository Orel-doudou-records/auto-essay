import {
  addNarrativeArcStage,
  createNarrativeArc,
  deriveNarrativeArcProgress,
  evaluateNarrativeArc,
  getNarrativeFrameworkTemplate,
  updateNarrativeArcStage,
} from "../src/index";

describe("narrative arcs", () => {
  it("supports a protagonist arc with a three-act structure", () => {
    const arc = createNarrativeArc({
      projectId: "project-1",
      title: "Mara cesse de protéger le mensonge du village",
      subject: { id: "character-mara", kind: "character", label: "Mara" },
      roles: ["protagonist", "witness"],
      framework: "three-act",
      trajectory: "positive",
      dramaticQuestion: "Mara choisira-t-elle la vérité plutôt que l'appartenance ?",
      narrativeFunction: "Porter le conflit entre vérité individuelle et survie collective.",
      psychologicalFunction: "Transformer la loyauté défensive en responsabilité morale.",
      initialState: {
        summary: "Mara protège le village et rationalise ses silences.",
        dimensions: {
          belief: "La communauté doit être protégée, même par le mensonge.",
          fear: "Être rejetée par les siens.",
        },
      },
      targetState: {
        summary: "Mara accepte de perdre sa place pour dire ce qu'elle sait.",
        dimensions: {
          belief: "Une communauté qui exige le mensonge ne peut pas être sauvée intacte.",
        },
      },
    });

    const setup = addNarrativeArcStage(arc, {
      label: "Le pacte du silence",
      kind: "exposition",
      frameworkBeat: "setup",
      narrativeFunction: "Montrer la loyauté initiale de Mara.",
      resultingState: {
        summary: "Mara renouvelle tacitement son adhésion au silence collectif.",
      },
      sceneRefs: ["scene-1"],
      status: "committed",
    });

    const incident = addNarrativeArcStage(setup, {
      label: "Le corps dans le ravin",
      kind: "inciting-incident",
      frameworkBeat: "inciting-incident",
      narrativeFunction: "Rendre le silence moralement intenable.",
      pressure: "Un mort relie le secret du village à une violence présente.",
      choiceOrResponse: "Mara cache d'abord un indice.",
      resultingState: {
        summary: "Mara agit désormais consciemment contre ce qu'elle sait être juste.",
      },
      sceneRefs: ["scene-2"],
      status: "committed",
    });

    const progress = deriveNarrativeArcProgress(incident);
    expect(progress).toMatchObject({
      totalStages: 2,
      committedStages: 2,
      progress: 1,
    });

    const findings = evaluateNarrativeArc(incident);
    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missing-framework-beat", frameworkBeat: "midpoint" }),
        expect.objectContaining({ code: "no-climax" }),
      ])
    );
  });

  it("supports a non-physical environmental arc without requiring psychology", () => {
    const marsh = createNarrativeArc({
      projectId: "project-1",
      title: "La tourbière reprend le village",
      subject: {
        id: "environment-marsh",
        kind: "environment",
        label: "La tourbière",
      },
      roles: ["setting-force", "antagonist", "symbolic"],
      framework: "freytag",
      trajectory: "ambiguous",
      narrativeFunction:
        "Transformer l'isolement géographique en pression active sur les habitants.",
      appearanceLogic:
        "D'abord décor périphérique, puis obstacle, menace et enfin nouvel ordre matériel.",
      resolutionLogic:
        "Le dénouement ne vainc pas le milieu : il redéfinit la frontière habitable.",
      initialState: {
        summary: "La tourbière semble stable et contenue à la lisière du village.",
        dimensions: {
          waterLevel: "bas",
          accessibility: "routes praticables",
          perceivedAgency: "décor",
        },
      },
      targetState: {
        summary: "La tourbière a absorbé la route et coupé définitivement l'ancien accès.",
        dimensions: {
          waterLevel: "haut",
          accessibility: "route principale noyée",
          perceivedAgency: "force structurante du dénouement",
        },
      },
    });

    const rising = addNarrativeArcStage(marsh, {
      label: "Les pluies ferment la route basse",
      kind: "rising-action",
      frameworkBeat: "rising-action",
      narrativeFunction: "Convertir le paysage en contrainte d'action.",
      transformation: "Le milieu retire progressivement des options aux personnages.",
      resultingState: {
        summary: "Le village ne dispose plus que d'une sortie praticable.",
        dimensions: {
          accessibility: "une seule route",
          tension: "croissante",
        },
      },
      sceneRefs: ["scene-4"],
      status: "observed",
      presentation: {
        focalization: "external",
        temporalRelation: "chronological",
        duration: "summary",
      },
    });

    expect(rising.psychologicalFunction).toBeUndefined();
    expect(evaluateNarrativeArc(rising)).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "psychology-on-non-character" }),
      ])
    );
  });

  it("keeps causal arc order separate from non-linear presentation", () => {
    let arc = createNarrativeArc({
      projectId: "project-1",
      title: "L'aveu de Jonas",
      subject: { id: "character-jonas", kind: "character", label: "Jonas" },
      roles: ["deuteragonist"],
      framework: "custom",
      trajectory: "disillusionment",
      narrativeFunction: "Révéler progressivement le coût de son ancienne décision.",
      initialState: { summary: "Jonas vit comme si sa décision passée était close." },
    });

    arc = addNarrativeArcStage(arc, {
      order: 0,
      label: "La décision passée",
      kind: "exposition",
      narrativeFunction: "Établir la cause chronologique de la culpabilité.",
      resultingState: { summary: "Jonas choisit de se taire." },
      sceneRefs: ["scene-flashback"],
      presentation: {
        focalization: "internal",
        focalizerId: "character-jonas",
        temporalRelation: "analepsis",
        duration: "scene",
      },
    });

    arc = addNarrativeArcStage(arc, {
      order: 1,
      label: "L'aveu au présent",
      kind: "climax",
      narrativeFunction: "Transformer la culpabilité en action publique.",
      resultingState: { summary: "Jonas avoue ce qu'il a caché." },
      sceneRefs: ["scene-present"],
      presentation: {
        focalization: "internal",
        focalizerId: "character-jonas",
        temporalRelation: "chronological",
        duration: "scene",
      },
    });

    expect(arc.stages.map((stage) => stage.order)).toEqual([0, 1]);
    expect(arc.stages[0]?.presentation?.temporalRelation).toBe("analepsis");
  });

  it("prevents duplicate stage orders and protects author-locked stages", () => {
    let arc = createNarrativeArc({
      projectId: "project-1",
      title: "Arc secondaire",
      subject: { id: "character-ines", kind: "character", label: "Inès" },
      roles: ["ally"],
      narrativeFunction: "Faire varier la confiance accordée au protagoniste.",
      initialState: { summary: "Inès se tient à distance." },
    });

    arc = addNarrativeArcStage(arc, {
      order: 0,
      label: "Alliance fragile",
      kind: "confrontation",
      narrativeFunction: "Créer une alliance provisoire.",
      resultingState: { summary: "Inès accepte une coopération limitée." },
      authorLocked: true,
    });

    expect(() =>
      addNarrativeArcStage(arc, {
        order: 0,
        label: "Collision",
        kind: "custom",
        narrativeFunction: "Ne doit pas être ajoutée.",
        resultingState: { summary: "État invalide." },
      })
    ).toThrow("already exists");

    const lockedStageId = arc.stages[0]?.id;
    expect(lockedStageId).toBeDefined();
    expect(() =>
      updateNarrativeArcStage(arc, lockedStageId!, {
        narrativeFunction: "Réécriture interdite.",
      })
    ).toThrow("author-locked");
  });

  it("exposes reusable framework templates without forcing them", () => {
    const freytag = getNarrativeFrameworkTemplate("freytag");
    const heroJourney = getNarrativeFrameworkTemplate("hero-journey");
    const todorov = getNarrativeFrameworkTemplate("todorov");

    expect(freytag.beats.map((beat) => beat.key)).toEqual([
      "exposition",
      "rising-action",
      "climax",
      "falling-action",
      "resolution",
    ]);
    expect(heroJourney.beats.some((beat) => beat.key === "ordeal")).toBe(true);
    expect(todorov.beats.map((beat) => beat.key)).toEqual([
      "manipulation",
      "competence",
      "performance",
      "sanction",
    ]);
  });
});
