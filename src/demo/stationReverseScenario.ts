import { runFullPipelineDemo } from "./fullPipelineDemo";
import type {
  FullPipelineDemoDefinition,
  FullPipelineDemoOptions,
  FullPipelineDemoResult,
} from "./pipelineDemoTypes";

/**
 * Cas éditorial construit à partir de deux documents réels fournis au projet :
 * - « # Charte maître — Nexus Diaspora.txt »
 * - « # SPR — Nexus Diaspora Erykah Badu.txt »
 *
 * Les extraits sont volontairement courts : ils servent de corpus éditorial
 * local, pas de source factuelle exhaustive sur Erykah Badu.
 */
export const STATION_REVERSE_DEMO_DEFINITION: FullPipelineDemoDefinition = {
  scenarioId: "station-reverse-badu-infrastructure",
  projectId: "station-reverse-demo",
  sectionId: "section-badu-infrastructure",
  sectionUnitId: "section-unit-station-reverse",
  sectionTitle: "Du symbole à l'infrastructure",
  thesis:
    "Une lecture située doit partir d'une forme concrète, montrer ce qu'elle organise et préserver la priorité de la justesse sur l'effet poétique.",
  projectContext:
    "Démontrer sur les matériaux éditoriaux de Station Reverse comment une image ou un symbole devient une lecture d'infrastructure sans se substituer à la preuve.",
  sources: [
    {
      key: "nexus-charter",
      title: "Charte maître — Nexus Diaspora",
      content:
        "La beauté du texte vient après sa justesse. Le texte avance par blocs de pensée, par images concrètes, par raccords sensibles, par démonstrations brèves mais solides. Une image doit éclairer le sujet. Elle ne doit jamais se substituer au raisonnement. Toute production doit contenir un ancrage vérifiable ou démontrable. Une phrase doit porter une idée, une sensation ou une preuve. Idéalement les trois.",
      type: "markdown",
      regime: "author_interpretation",
      authors: ["Station Reverse"],
      epistemicLimits: [
        "La charte formule des règles éditoriales ; elle ne fournit pas de preuve biographique ou historique sur l'artiste.",
      ],
      position: {
        role: "editor",
        perspective: "Charte de rédaction et d'évaluation de la voix Nexus Diaspora",
        institutionalAffiliation: "Station Reverse",
      },
    },
    {
      key: "badu-spr",
      title: "SPR — Nexus Diaspora / Erykah Badu",
      content:
        "Documentation devient angle quand le fait cesse d’être isolé et devient symptôme, protocole ou infrastructure. Angle devient conséquence quand l’analyse montre ce que la forme protège, déplace, conteste ou rend possible pour la diaspora. Le raisonnement cherche moins à expliquer une œuvre qu’à montrer ce qu’elle fait dans le monde. La bonne lecture ne s’arrête donc jamais au symbole. Elle pousse jusqu’à l’infrastructure, puis de l’infrastructure jusqu’à la conséquence collective.",
      type: "markdown",
      regime: "criticism",
      authors: ["Station Reverse"],
      epistemicLimits: [
        "Le SPR est un cadrage critique et méthodologique ; il ne remplace pas les sources primaires nécessaires à un article factuel.",
      ],
      position: {
        role: "critic",
        perspective: "Grille de lecture diasporique et politique",
        institutionalAffiliation: "Station Reverse",
      },
    },
  ],
  claims: [
    {
      key: "truth-before-effect",
      statement:
        "La charte Station Reverse place la justesse avant l'intensité poétique.",
      sourceKeys: ["nexus-charter"],
      confidenceLevel: "certain",
      claimType: "fact",
    },
    {
      key: "image-serves-reasoning",
      statement:
        "Dans la charte, une image doit éclairer le raisonnement sans s'y substituer.",
      sourceKeys: ["nexus-charter"],
      confidenceLevel: "certain",
      claimType: "fact",
    },
    {
      key: "symbol-to-infrastructure",
      statement:
        "Le SPR Erykah Badu organise la lecture du symbole vers l'infrastructure puis vers la conséquence collective.",
      sourceKeys: ["badu-spr"],
      confidenceLevel: "certain",
      claimType: "interpretation",
    },
  ],
  observation: {
    sourceKey: "nexus-charter",
    authorId: "nexus-diaspora-editorial-corpus",
    sourceLabel: "Charte maître — Nexus Diaspora",
    excerpt:
      "Une image doit éclairer le sujet. Elle ne doit jamais se substituer au raisonnement.",
    argumentativeFunction:
      "encadrer l'usage de l'image par une exigence de preuve et de raisonnement",
    claimTypes: ["fact", "interpretation"],
    sourceRegimes: ["author_interpretation", "criticism"],
    relations: ["image au service du raisonnement"],
    tensions: ["intensité poétique contre justesse documentaire"],
    concepts: ["ancrage", "infrastructure", "conséquence collective"],
    operation: {
      family: "figuration_genre",
      category: "metaphor",
      trigger: "une image est mobilisée pour lire une forme culturelle",
      operation:
        "adosser l'image à un détail concret puis expliciter sa fonction analytique",
      target: "figurative_system",
      observedEffect:
        "maintient la densité poétique sous le contrôle du raisonnement",
      intensity: "structuring",
    },
    effects: {
      argumentative: ["empêche l'image de remplacer la démonstration"],
      epistemic: ["préserve la priorité de la justesse"],
      reception: ["rend le passage lyrique lisible et vérifiable"],
    },
    confidence: "high",
    notes: [
      "Cette observation décrit une règle éditoriale située, pas une signature universelle de l'auteur.",
    ],
  },
  additionalRelation: {
    type: "reframes",
    participants: [
      {
        kind: "source",
        key: "badu-spr",
        role: "critical_framework",
      },
      {
        kind: "claim",
        key: "symbol-to-infrastructure",
        role: "reframed_claim",
      },
    ],
    description:
      "Le SPR déplace la lecture d'une forme isolée vers l'infrastructure et la conséquence collective.",
    evidence: [
      { kind: "source", key: "badu-spr" },
      { kind: "claim", key: "symbol-to-infrastructure" },
    ],
    confidence: "high",
  },
  preferredRelationType: "reframes",
  articulation: {
    operation: {
      family: "enunciation_structure",
      category: "section_progression",
      operation:
        "partir d'un détail matériel, nommer ce qu'il organise, puis pousser l'analyse vers l'infrastructure et la conséquence collective",
      target: "section",
      rationale:
        "le cadre critique demande que la forme reste concrète avant de devenir lecture politique",
      intensity: "structuring",
    },
    effects: {
      content: [
        "faire passer le détail du statut de symbole au statut de dispositif",
        "relier chaque interprétation à une conséquence politique ou culturelle",
      ],
      form: [
        "alterner ancrage concret et expansion analytique",
        "réserver l'image au moment où elle clarifie une relation déjà documentée",
      ],
      argumentative: [
        "montrer ce qu'une forme organise plutôt que seulement ce qu'elle signifie",
      ],
      epistemic: [
        "maintenir la distinction entre règle éditoriale, interprétation et fait",
      ],
      emotional: ["garder une vibration sensible sans emphase automatique"],
      reception: ["rendre la lecture politique accessible sans l'aplatir"],
    },
    contentCommitments: [
      "Commencer par une forme ou une règle concrète présente dans le corpus.",
      "Pousser l'analyse jusqu'à l'infrastructure et à la conséquence collective.",
      "Nommer le statut éditorial des sources utilisées.",
    ],
    formalCommitments: [
      "Faire suivre chaque image d'une fonction analytique explicite.",
      "Alterner phrase d'ancrage et développement critique.",
    ],
    invariants: [
      "La beauté du texte vient après sa justesse.",
      "Une image ne se substitue jamais au raisonnement.",
      "Distinguer fait, interprétation et règle éditoriale.",
    ],
    prohibitedShortcuts: [
      "Ne pas transformer la charte en preuve biographique sur Erykah Badu.",
      "Ne pas appeler infrastructure une image qui reste sans conséquence démontrée.",
      "Ne pas ajouter une métaphore uniquement pour intensifier la voix.",
    ],
    risks: [
      {
        description:
          "Le vocabulaire d'infrastructure peut devenir un automatisme abstrait.",
        impact: "high",
        mitigation:
          "Exiger un objet, un geste, une règle ou une circulation concrète avant chaque montée conceptuelle.",
      },
    ],
  },
  paragraphs: [
    {
      unitId: "station-reverse-paragraph-1",
      paragraphId: "paragraph-1",
      argumentativeFunction:
        "poser la règle de justesse et distinguer le rôle des deux documents",
      sourceKeys: ["nexus-charter", "badu-spr"],
      claimKeys: ["truth-before-effect", "image-serves-reasoning"],
      contentOperations: [
        "nommer la priorité éditoriale",
        "définir la fonction autorisée de l'image",
      ],
      content:
        "La charte pose d'abord une hiérarchie nette : la beauté vient après la justesse. Ce principe ne retire pas l'image du texte ; il lui donne une tâche. L'image éclaire une relation déjà construite, elle ne fabrique pas seule la preuve. Le détail reste visible avant de devenir concept. Dans ce cadre, une phrase sensorielle vaut lorsqu'elle rapproche une matière, une idée et un effet vérifiable. Le corpus critique sur Erykah Badu intervient donc comme méthode de lecture, non comme archive factuelle suffisante sur l'artiste.",
      traceExcerpt:
        "Le détail reste visible avant de devenir concept.",
      traceDeclaration:
        "Le paragraphe part d'une règle concrète avant de monter vers le concept.",
    },
    {
      unitId: "station-reverse-paragraph-2",
      paragraphId: "paragraph-2",
      argumentativeFunction:
        "montrer le passage du symbole à l'infrastructure",
      sourceKeys: ["nexus-charter", "badu-spr"],
      claimKeys: ["symbol-to-infrastructure", "image-serves-reasoning"],
      contentOperations: [
        "déplacer la lecture du symbole vers le dispositif",
        "nommer une conséquence collective",
      ],
      content:
        "Le SPR pousse ensuite la lecture au-delà du symbole. Une forme compte parce qu'elle organise une circulation, une protection, une visibilité ou un refus. L'infrastructure commence au moment où le détail révèle ce qu'il soutient et ce qu'il rend possible. L'image ouvre la porte ; le raisonnement doit traverser la pièce. Ce déplacement protège le texte contre deux dérives : la décoration politique, qui colle un grand mot sur une surface, et l'abstraction, qui oublie l'objet dont elle prétend parler. La conséquence collective devient alors le test final de la lecture.",
      traceExcerpt:
        "L'image ouvre la porte ; le raisonnement doit traverser la pièce.",
      traceDeclaration:
        "La métaphore est immédiatement reliée à une fonction analytique et à un test de conséquence.",
    },
    {
      unitId: "station-reverse-paragraph-3",
      paragraphId: "paragraph-3",
      argumentativeFunction:
        "rendre explicites les limites documentaires du cas",
      sourceKeys: ["nexus-charter", "badu-spr"],
      claimKeys: [
        "truth-before-effect",
        "symbol-to-infrastructure",
        "image-serves-reasoning",
      ],
      contentOperations: [
        "séparer méthode critique et preuve factuelle",
        "maintenir une dette documentaire explicite",
      ],
      content:
        "Cette démonstration reste toutefois un cas éditorial. La charte décrit une exigence d'écriture ; le SPR formalise une grille de lecture. Aucun des deux documents ne suffit à établir seul une date, une pratique ou une intention attribuable à Erykah Badu. La limite documentaire demeure dans le texte au lieu d'être recouverte par la voix. C'est précisément là que Literacraft devient utile : la forme peut porter une pensée située, mais le plan, l'évaluation et la révision continuent de protéger la frontière entre ce que le corpus affirme et ce qu'une enquête future devra vérifier.",
      traceExcerpt:
        "La limite documentaire demeure dans le texte au lieu d'être recouverte par la voix.",
      traceDeclaration:
        "Le paragraphe rend la limite épistémique visible avant la clôture.",
    },
  ],
  essayAssessment: {
    overallScore: 8.4,
    dimensions: {
      claimSupport: 8.5,
      citationIntegrity: 8,
      counterargumentQuality: 7.5,
      transitionClarity: 8.5,
      scopeControl: 9,
      voiceConsistency: 8.5,
    },
    verdict: "keep_with_minor_edits",
    top3Revisions: [
      {
        priority: 1,
        target: "deuxième paragraphe",
        issue:
          "La conséquence collective reste formulée comme un test général plutôt que comme une opération précise.",
        approach:
          "Nommer plus explicitement ce que la lecture d'infrastructure change dans le traitement éditorial du détail.",
      },
    ],
  },
  editorialAssessment: {
    status: "partially_effective",
    contentScore: 8,
    formScore: 5.8,
    contentFindings: [
      "La section distingue correctement charte, grille critique et preuve factuelle.",
      "Le passage du symbole à l'infrastructure est présent dans la progression.",
    ],
    formFindings: [
      "La métaphore de la porte clarifie le mouvement, mais la conséquence collective reste moins concrète que l'ancrage initial.",
    ],
    evidenceExcerpt:
      "L'image ouvre la porte ; le raisonnement doit traverser la pièce.",
    suggestedRepair:
      "Après la métaphore, ajouter une opération éditoriale concrète montrant comment le détail réorganise l'attribution, le choix des sources ou la conséquence politique.",
    contentFormCoherence: 5.9,
    overallEditorialScore: 5.9,
    summary:
      "La priorité documentaire et la progression critique sont respectées ; la dernière étape vers la conséquence collective doit être rendue plus opératoire.",
  },
};

export async function runStationReverseDemo(
  options?: FullPipelineDemoOptions
): Promise<FullPipelineDemoResult> {
  return runFullPipelineDemo(STATION_REVERSE_DEMO_DEFINITION, options);
}
