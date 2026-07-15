import {
  runFullPipelineDemo,
  type FullPipelineDemoDefinition,
  type FullPipelineDemoOptions,
  type FullPipelineDemoResult,
} from "./fullPipelineDemo";

export const SYNTHETIC_DEMO_DEFINITION: FullPipelineDemoDefinition = {
  scenarioId: "synthetic-contradictory-archive",
  projectId: "demo-project-synthetic",
  sectionId: "section-contradictory-archive",
  sectionUnitId: "section-unit-synthetic",
  sectionTitle: "Deux archives, une contradiction maintenue",
  thesis:
    "Une contradiction documentaire doit rester attribuée avant toute interprétation.",
  projectContext:
    "Démontrer comment Auto Essay maintient deux chronologies incompatibles sans produire une synthèse non soutenue.",
  sources: [
    {
      key: "archive-a",
      title: "Registre municipal A",
      content:
        "Le registre municipal A situe l'ouverture du lieu en 1984. Il ne documente ni la période de préparation ni les usages informels antérieurs.",
      type: "note",
      regime: "institutional_archive",
      authors: ["Service des archives"],
      epistemicLimits: [
        "Le registre décrit une date administrative, pas nécessairement le début des usages sociaux du lieu.",
      ],
      position: {
        role: "institutional_record",
        institutionalAffiliation: "Archives municipales",
      },
    },
    {
      key: "testimony-b",
      title: "Témoignage B",
      content:
        "Le témoignage B situe l'ouverture publique en 1987 et décrit trois années de réunions informelles avant cette date.",
      type: "note",
      regime: "testimony",
      authors: ["Témoin B"],
      epistemicLimits: [
        "Le témoignage est rétrospectif et ne suffit pas à fixer seul une date administrative.",
      ],
      position: {
        role: "primary_witness",
        perspective: "Participant aux réunions informelles",
      },
    },
    {
      key: "author-reference",
      title: "Passage de référence de l'auteur",
      content:
        "Le premier document fixe 1984. Le second déplace la scène vers 1987. Je garde les deux dates visibles : la contradiction devient une méthode de lecture, pas un défaut à effacer.",
      type: "note",
      regime: "author_interpretation",
      authors: ["Auteur de démonstration"],
      epistemicLimits: [
        "Ce passage fournit une pratique d'écriture, pas une preuve supplémentaire sur la chronologie.",
      ],
      position: {
        role: "editor",
        perspective: "Référence de pratique rédactionnelle",
      },
    },
  ],
  claims: [
    {
      key: "date-1984",
      statement: "Le registre administratif situe l'ouverture en 1984.",
      sourceKeys: ["archive-a"],
      confidenceLevel: "certain",
      claimType: "fact",
    },
    {
      key: "date-1987",
      statement: "Le témoignage situe l'ouverture publique en 1987.",
      sourceKeys: ["testimony-b"],
      confidenceLevel: "probable",
      claimType: "counterclaim",
      contradictionOfKey: "date-1984",
    },
  ],
  observation: {
    sourceKey: "author-reference",
    authorId: "demo-author",
    sourceLabel: "Passage de référence de l'auteur",
    excerpt:
      "Je garde les deux dates visibles : la contradiction devient une méthode de lecture, pas un défaut à effacer.",
    argumentativeFunction: "maintenir une contradiction documentaire attribuée",
    claimTypes: ["fact", "counterclaim"],
    sourceRegimes: ["institutional_archive", "testimony"],
    relations: ["deux chronologies incompatibles"],
    tensions: ["date administrative contre mémoire d'usage"],
    concepts: ["attribution", "contradiction productive"],
    operation: {
      family: "enunciation_structure",
      category: "contradiction_structure",
      trigger: "deux sources situent différemment le même événement",
      operation: "maintenir les deux dates visibles et attribuées",
      target: "source_voice",
      observedEffect: "empêche une synthèse documentaire artificielle",
      intensity: "structuring",
    },
    effects: {
      argumentative: ["transforme la contradiction en objet d'analyse"],
      epistemic: ["préserve les limites de chaque régime documentaire"],
      reception: ["rend le désaccord intelligible"],
    },
    confidence: "high",
  },
  preferredRelationType: "contradicts",
  articulation: {
    operation: {
      family: "enunciation_structure",
      category: "claim_attribution",
      operation:
        "attribuer séparément les deux chronologies avant de décrire leur tension",
      target: "source_voice",
      rationale:
        "la contradiction porte sur le même événement mais provient de régimes documentaires différents",
      intensity: "structuring",
    },
    effects: {
      content: [
        "maintenir les deux dates comme claims distincts",
        "faire de l'écart entre date administrative et usage social l'objet de la section",
      ],
      form: [
        "séparer clairement les voix documentaires",
        "ralentir la transition avant toute interprétation",
      ],
      argumentative: ["éviter une résolution non soutenue"],
      epistemic: ["rendre les limites des sources visibles"],
      reception: ["permettre au lecteur de suivre le désaccord"],
    },
    contentCommitments: [
      "Présenter les deux claims sans les fusionner.",
      "Nommer la différence entre date administrative et ouverture publique.",
    ],
    formalCommitments: [
      "Attribuer chaque chronologie à sa source.",
      "Faire précéder l'interprétation par une phrase de séparation documentaire.",
    ],
    invariants: [
      "Conserver les niveaux de confiance distincts.",
      "Ne pas inventer une troisième date de synthèse.",
    ],
    prohibitedShortcuts: [
      "Ne pas présenter le témoignage comme un registre administratif.",
      "Ne pas résoudre la contradiction par une formule vague.",
    ],
    risks: [
      {
        description: "La répétition des dates peut devenir mécanique.",
        impact: "medium",
        mitigation: "Faire varier la fonction de chaque rappel documentaire.",
      },
    ],
  },
  paragraphs: [
    {
      unitId: "synthetic-paragraph-1",
      paragraphId: "paragraph-1",
      argumentativeFunction: "poser les deux chronologies",
      sourceKeys: ["archive-a", "testimony-b"],
      claimKeys: ["date-1984", "date-1987"],
      contentOperations: [
        "nommer la date du registre",
        "attribuer la date du témoignage",
      ],
      content:
        "Le registre municipal fixe l'ouverture administrative en 1984. Le témoignage B situe pourtant l'ouverture publique en 1987 et décrit des réunions informelles durant l'intervalle. Les deux dates restent séparées, chacune attachée au document qui la porte. Cette attribution empêche de transformer un désaccord de sources en chronologie lisse. Elle indique aussi que le mot ouverture ne désigne peut-être pas le même événement selon le régime documentaire consulté.",
      traceExcerpt:
        "Les deux dates restent séparées, chacune attachée au document qui la porte.",
      traceDeclaration:
        "Les chronologies ont été séparées et attribuées avant l'interprétation.",
    },
    {
      unitId: "synthetic-paragraph-2",
      paragraphId: "paragraph-2",
      argumentativeFunction: "interpréter l'écart sans le résoudre",
      sourceKeys: ["archive-a", "testimony-b"],
      claimKeys: ["date-1984", "date-1987"],
      contentOperations: [
        "distinguer statut administratif et usage social",
        "maintenir l'incertitude documentaire",
      ],
      content:
        "L'écart entre 1984 et 1987 déplace donc la question. Le registre décrit un acte administratif ; le témoignage décrit une entrée dans l'usage public. Cette différence de régime ne tranche pas la chronologie à elle seule. Elle rend visible deux manières de faire commencer un lieu : par son inscription officielle ou par la mémoire de celles et ceux qui l'ont pratiqué. La contradiction reste ouverte, mais elle devient précise. Le texte peut alors examiner ce que chaque date autorise à raconter sans prétendre qu'une formule réconcilie les documents.",
      traceExcerpt:
        "La contradiction reste ouverte, mais elle devient précise.",
      traceDeclaration:
        "L'écart documentaire a été maintenu comme tension interprétable.",
    },
  ],
  essayAssessment: {
    overallScore: 8.1,
    dimensions: {
      claimSupport: 8.5,
      citationIntegrity: 8,
      counterargumentQuality: 8,
      transitionClarity: 8,
      scopeControl: 8.5,
      voiceConsistency: 7.5,
    },
    verdict: "keep_with_minor_edits",
    top3Revisions: [
      {
        priority: 1,
        target: "transition finale",
        issue: "La fonction politique de l'écart reste peu développée.",
        approach:
          "Préciser ce que chaque définition de l'ouverture rend visible dans l'histoire du lieu.",
      },
    ],
  },
  editorialAssessment: {
    status: "partially_effective",
    contentScore: 7,
    formScore: 5.5,
    contentFindings: [
      "Les deux chronologies restent distinctes et correctement attribuées.",
    ],
    formFindings: [
      "La seconde transition accélère avant d'expliciter complètement le changement de régime documentaire.",
    ],
    evidenceExcerpt:
      "La contradiction reste ouverte, mais elle devient précise.",
    suggestedRepair:
      "Ajouter une phrase reliant explicitement le changement de régime documentaire au changement de sens du mot ouverture.",
    contentFormCoherence: 5.8,
    overallEditorialScore: 5.9,
    summary:
      "La contradiction est préservée, mais la relation entre attribution formelle et enjeu documentaire doit être rendue plus nette.",
  },
};

export async function runSyntheticDemo(
  options?: FullPipelineDemoOptions
): Promise<FullPipelineDemoResult> {
  return runFullPipelineDemo(SYNTHETIC_DEMO_DEFINITION, options);
}
