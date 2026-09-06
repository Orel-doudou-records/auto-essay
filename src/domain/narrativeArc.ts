import { z } from "zod";

/**
 * Structure théorique utilisée comme grille de lecture de l'arc.
 * Elle guide la planification sans devenir une recette obligatoire.
 */
export const NarrativeFrameworkSchema = z.enum([
  "custom",
  "freytag",
  "three-act",
  "hero-journey",
  "save-the-cat",
  "todorov",
  "propp",
]);

export type NarrativeFramework = z.infer<typeof NarrativeFrameworkSchema>;

/**
 * Un arc peut appartenir à un personnage, mais aussi à une entité non humaine.
 * Le milieu naturel, un village, une institution ou une relation peuvent ainsi
 * porter leur propre transformation narrative.
 */
export const NarrativeArcSubjectKindSchema = z.enum([
  "character",
  "collective",
  "relationship",
  "place",
  "environment",
  "institution",
  "object",
  "system",
  "narrator",
  "other",
]);

export type NarrativeArcSubjectKind = z.infer<
  typeof NarrativeArcSubjectKindSchema
>;

export const NarrativeArcSubjectSchema = z.object({
  id: z.string().min(1),
  kind: NarrativeArcSubjectKindSchema,
  label: z.string().min(1),
});

export type NarrativeArcSubject = z.infer<typeof NarrativeArcSubjectSchema>;

export const NarrativeRoleSchema = z.enum([
  "protagonist",
  "antagonist",
  "deuteragonist",
  "ally",
  "mentor",
  "foil",
  "witness",
  "catalyst",
  "chorus",
  "setting-force",
  "macguffin",
  "symbolic",
  "other",
]);

export type NarrativeRole = z.infer<typeof NarrativeRoleSchema>;

export const NarrativeArcTrajectorySchema = z.enum([
  "positive",
  "negative",
  "flat",
  "tragic",
  "corruption",
  "disillusionment",
  "circular",
  "ambiguous",
  "unresolved",
  "custom",
]);

export type NarrativeArcTrajectory = z.infer<
  typeof NarrativeArcTrajectorySchema
>;

/**
 * État narratif générique. `dimensions` permet d'exprimer une psychologie
 * (croyance, peur, désir) mais aussi un état non humain (niveau de crue,
 * isolement, pression sociale, état d'un bâtiment, etc.).
 */
export const NarrativeArcStateSchema = z.object({
  summary: z.string().min(1),
  dimensions: z.record(z.string()).default({}),
});

export type NarrativeArcState = z.infer<typeof NarrativeArcStateSchema>;
export type NarrativeArcStateInput = z.input<typeof NarrativeArcStateSchema>;

/**
 * Présentation du beat dans le récit. Elle est volontairement séparée de
 * `order`, qui représente l'ordre causal de transformation de l'arc.
 */
export const NarrativePresentationSchema = z.object({
  focalization: z.enum(["zero", "internal", "external", "mixed"]).optional(),
  focalizerId: z.string().min(1).optional(),
  temporalRelation: z
    .enum(["chronological", "analepsis", "prolepsis", "repetition"])
    .default("chronological"),
  duration: z
    .enum(["scene", "summary", "ellipsis", "pause", "stretch"])
    .default("scene"),
});

export type NarrativePresentation = z.infer<
  typeof NarrativePresentationSchema
>;
export type NarrativePresentationInput = z.input<
  typeof NarrativePresentationSchema
>;

export const NarrativeArcStageStatusSchema = z.enum([
  "planned",
  "observed",
  "committed",
  "superseded",
]);

export type NarrativeArcStageStatus = z.infer<
  typeof NarrativeArcStageStatusSchema
>;

export const NarrativeArcStageKindSchema = z.enum([
  "exposition",
  "inciting-incident",
  "rising-action",
  "threshold",
  "confrontation",
  "midpoint",
  "crisis",
  "climax",
  "falling-action",
  "transformation",
  "return",
  "resolution",
  "custom",
]);

export type NarrativeArcStageKind = z.infer<
  typeof NarrativeArcStageKindSchema
>;

export const NarrativeArcAppearanceSchema = z.enum([
  "absent",
  "foreshadowed",
  "present",
  "foregrounded",
  "withdrawn",
  "returned",
  "resolved",
]);

export type NarrativeArcAppearance = z.infer<
  typeof NarrativeArcAppearanceSchema
>;

export const NarrativeArcStageSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().nonnegative(),
  label: z.string().min(1),
  kind: NarrativeArcStageKindSchema,
  /** Beat théorique facultatif, ex. `midpoint`, `ordeal`, `sanction`. */
  frameworkBeat: z.string().min(1).optional(),
  narrativeFunction: z.string().min(1),
  pressure: z.string().min(1).optional(),
  choiceOrResponse: z.string().min(1).optional(),
  transformation: z.string().min(1).optional(),
  resultingState: NarrativeArcStateSchema,
  appearance: NarrativeArcAppearanceSchema.default("present"),
  sceneRefs: z.array(z.string().min(1)).default([]),
  presentation: NarrativePresentationSchema.optional(),
  status: NarrativeArcStageStatusSchema.default("planned"),
  authorLocked: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type NarrativeArcStage = z.infer<typeof NarrativeArcStageSchema>;
export type NarrativeArcStageInput = z.input<typeof NarrativeArcStageSchema>;

export const NarrativeArcSchema = z
  .object({
    id: z.string(),
    projectId: z.string().min(1),
    title: z.string().min(1),
    subject: NarrativeArcSubjectSchema,
    roles: z.array(NarrativeRoleSchema).min(1),
    framework: NarrativeFrameworkSchema.default("custom"),
    trajectory: NarrativeArcTrajectorySchema.default("custom"),
    dramaticQuestion: z.string().min(1).optional(),
    narrativeFunction: z.string().min(1),
    psychologicalFunction: z.string().min(1).optional(),
    appearanceLogic: z.string().min(1).optional(),
    resolutionLogic: z.string().min(1).optional(),
    initialState: NarrativeArcStateSchema,
    targetState: NarrativeArcStateSchema.optional(),
    stages: z.array(NarrativeArcStageSchema).default([]),
    status: z.enum(["draft", "active", "resolved", "abandoned"]).default("draft"),
    authorLocked: z.boolean().default(false),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .superRefine((arc, context) => {
    const ids = new Set<string>();
    const orders = new Set<number>();

    for (const [index, stage] of arc.stages.entries()) {
      if (ids.has(stage.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["stages", index, "id"],
          message: `Narrative arc stage id '${stage.id}' is duplicated`,
        });
      }
      ids.add(stage.id);

      if (orders.has(stage.order)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["stages", index, "order"],
          message: `Narrative arc stage order '${stage.order}' is duplicated`,
        });
      }
      orders.add(stage.order);
    }
  });

export type NarrativeArc = z.infer<typeof NarrativeArcSchema>;
export type NarrativeArcInput = z.input<typeof NarrativeArcSchema>;

export interface NarrativeFrameworkBeat {
  key: string;
  label: string;
  kind: NarrativeArcStageKind;
  purpose: string;
}

export interface NarrativeFrameworkTemplate {
  framework: Exclude<NarrativeFramework, "custom">;
  beats: readonly NarrativeFrameworkBeat[];
}

const FREYTAG_BEATS: readonly NarrativeFrameworkBeat[] = [
  { key: "exposition", label: "Exposition", kind: "exposition", purpose: "Établir l'état initial et rendre perceptible la tension latente." },
  { key: "rising-action", label: "Action montante", kind: "rising-action", purpose: "Augmenter les pressions et rendre l'état initial de moins en moins tenable." },
  { key: "climax", label: "Climax", kind: "climax", purpose: "Forcer la collision décisive entre l'état du sujet et la réalité dramatique." },
  { key: "falling-action", label: "Action descendante", kind: "falling-action", purpose: "Déployer les conséquences irréversibles de la collision." },
  { key: "resolution", label: "Résolution", kind: "resolution", purpose: "Stabiliser ou laisser volontairement ambigu le nouvel état." },
];

const THREE_ACT_BEATS: readonly NarrativeFrameworkBeat[] = [
  { key: "setup", label: "Setup", kind: "exposition", purpose: "Établir la version initiale du sujet, ses limites et son manque." },
  { key: "inciting-incident", label: "Inciting incident", kind: "inciting-incident", purpose: "Rendre l'état initial impossible à maintenir sans réponse." },
  { key: "confrontation", label: "Confrontation", kind: "confrontation", purpose: "Tester le sujet par une suite de conflits qui travaillent ses limites." },
  { key: "midpoint", label: "Midpoint", kind: "midpoint", purpose: "Modifier l'objectif, la croyance ou la lecture de la situation." },
  { key: "climax", label: "Climax", kind: "climax", purpose: "Exiger une décision qui n'était pas possible dans l'état initial." },
  { key: "resolution", label: "Resolution", kind: "resolution", purpose: "Montrer le nouvel équilibre et le prix de la transformation." },
];

const HERO_JOURNEY_BEATS: readonly NarrativeFrameworkBeat[] = [
  { key: "ordinary-world", label: "Monde ordinaire", kind: "exposition", purpose: "Établir l'identité et l'équilibre de départ." },
  { key: "call", label: "Appel", kind: "inciting-incident", purpose: "Introduire une exigence de transformation." },
  { key: "refusal", label: "Refus", kind: "confrontation", purpose: "Rendre visible la peur, la croyance ou l'attachement qui bloque le sujet." },
  { key: "mentor", label: "Mentor / aide", kind: "confrontation", purpose: "Apporter une ressource, une règle ou un contrepoint." },
  { key: "threshold", label: "Franchissement du seuil", kind: "threshold", purpose: "Rendre le retour à l'ancien état coûteux ou impossible." },
  { key: "tests", label: "Épreuves", kind: "rising-action", purpose: "Faire varier les pressions, alliances et échecs." },
  { key: "approach", label: "Approche", kind: "crisis", purpose: "Concentrer les enjeux vers l'épreuve centrale." },
  { key: "ordeal", label: "Épreuve suprême", kind: "climax", purpose: "Mettre en crise l'identité, la croyance ou l'intégrité du sujet." },
  { key: "reward", label: "Récompense", kind: "transformation", purpose: "Matérialiser le gain, la perte ou la lucidité issue de l'épreuve." },
  { key: "road-back", label: "Chemin du retour", kind: "falling-action", purpose: "Tester la transformation dans le monde des conséquences." },
  { key: "resurrection", label: "Résurrection", kind: "transformation", purpose: "Exiger une dernière mise en acte du nouvel état." },
  { key: "return", label: "Retour avec l'élixir", kind: "return", purpose: "Montrer ce que la transformation change au-delà du sujet." },
];

const SAVE_THE_CAT_BEATS: readonly NarrativeFrameworkBeat[] = [
  { key: "opening-image", label: "Opening Image", kind: "exposition", purpose: "Donner une image concrète de l'état initial." },
  { key: "theme-stated", label: "Theme Stated", kind: "exposition", purpose: "Faire apparaître la question ou contradiction thématique." },
  { key: "setup", label: "Set-Up", kind: "exposition", purpose: "Établir les besoins, défauts, relations et pressions de départ." },
  { key: "catalyst", label: "Catalyst", kind: "inciting-incident", purpose: "Perturber l'équilibre." },
  { key: "debate", label: "Debate", kind: "confrontation", purpose: "Mettre en scène l'hésitation ou la résistance au changement." },
  { key: "break-into-two", label: "Break into Two", kind: "threshold", purpose: "Engager le sujet dans une nouvelle logique d'action." },
  { key: "b-story", label: "B Story", kind: "confrontation", purpose: "Ouvrir une relation ou trame qui travaille le thème autrement." },
  { key: "fun-and-games", label: "Fun and Games", kind: "rising-action", purpose: "Explorer les promesses et conséquences du nouveau régime." },
  { key: "midpoint", label: "Midpoint", kind: "midpoint", purpose: "Créer une fausse victoire, une fausse défaite ou une révélation structurante." },
  { key: "bad-guys-close-in", label: "Bad Guys Close In", kind: "rising-action", purpose: "Comprimer les options et exacerber les contradictions." },
  { key: "all-is-lost", label: "All Is Lost", kind: "crisis", purpose: "Faire perdre au sujet son ancienne solution." },
  { key: "dark-night", label: "Dark Night of the Soul", kind: "crisis", purpose: "Transformer la crise extérieure en crise de sens." },
  { key: "break-into-three", label: "Break into Three", kind: "transformation", purpose: "Faire émerger la nouvelle logique qui rend le finale possible." },
  { key: "finale", label: "Finale", kind: "climax", purpose: "Mettre la transformation en acte sous pression maximale." },
  { key: "final-image", label: "Final Image", kind: "resolution", purpose: "Montrer visuellement ou concrètement l'écart avec l'état initial." },
];

const TODOROV_BEATS: readonly NarrativeFrameworkBeat[] = [
  { key: "manipulation", label: "Manipulation", kind: "inciting-incident", purpose: "Conférer, imposer ou faire émerger une mission au sujet." },
  { key: "competence", label: "Compétence", kind: "rising-action", purpose: "Acquérir savoir, pouvoir, ressources ou relations nécessaires." },
  { key: "performance", label: "Performance", kind: "climax", purpose: "Réaliser l'action qui transforme effectivement l'état." },
  { key: "sanction", label: "Sanction", kind: "resolution", purpose: "Juger, reconnaître, récompenser ou punir la transformation." },
];

const PROPP_BEATS: readonly NarrativeFrameworkBeat[] = [
  { key: "preparation", label: "Séquence préparatoire", kind: "exposition", purpose: "Installer manque, interdiction, transgression ou perturbation initiale." },
  { key: "quest", label: "Quête et épreuves", kind: "rising-action", purpose: "Faire agir les fonctions d'opposition, d'aide et d'épreuve." },
  { key: "confrontation", label: "Confrontation", kind: "climax", purpose: "Résoudre la fonction centrale de manque, méfait ou quête." },
  { key: "recognition", label: "Reconnaissance / réparation", kind: "resolution", purpose: "Rendre visibles les conséquences, identités et réparations finales." },
];

export const NARRATIVE_FRAMEWORK_TEMPLATES: Readonly<
  Record<Exclude<NarrativeFramework, "custom">, NarrativeFrameworkTemplate>
> = {
  freytag: { framework: "freytag", beats: FREYTAG_BEATS },
  "three-act": { framework: "three-act", beats: THREE_ACT_BEATS },
  "hero-journey": { framework: "hero-journey", beats: HERO_JOURNEY_BEATS },
  "save-the-cat": { framework: "save-the-cat", beats: SAVE_THE_CAT_BEATS },
  todorov: { framework: "todorov", beats: TODOROV_BEATS },
  propp: { framework: "propp", beats: PROPP_BEATS },
};

export interface CreateNarrativeArcInput {
  projectId: string;
  title: string;
  subject: NarrativeArcSubject;
  roles: NarrativeRole[];
  narrativeFunction: string;
  initialState: NarrativeArcStateInput;
  framework?: NarrativeFramework;
  trajectory?: NarrativeArcTrajectory;
  dramaticQuestion?: string;
  psychologicalFunction?: string;
  appearanceLogic?: string;
  resolutionLogic?: string;
  targetState?: NarrativeArcStateInput;
  stages?: NarrativeArcStageInput[];
  status?: NarrativeArc["status"];
  authorLocked?: boolean;
}

export function createNarrativeArc(input: CreateNarrativeArcInput): NarrativeArc {
  const now = new Date().toISOString();

  return NarrativeArcSchema.parse({
    id: crypto.randomUUID(),
    ...input,
    framework: input.framework ?? "custom",
    trajectory: input.trajectory ?? "custom",
    stages: input.stages ?? [],
    status: input.status ?? "draft",
    authorLocked: input.authorLocked ?? false,
    createdAt: now,
    updatedAt: now,
  });
}

export interface AddNarrativeArcStageInput {
  label: string;
  kind: NarrativeArcStageKind;
  narrativeFunction: string;
  resultingState: NarrativeArcStateInput;
  frameworkBeat?: string;
  pressure?: string;
  choiceOrResponse?: string;
  transformation?: string;
  appearance?: NarrativeArcAppearance;
  sceneRefs?: string[];
  presentation?: NarrativePresentationInput;
  status?: NarrativeArcStageStatus;
  authorLocked?: boolean;
  order?: number;
}

/**
 * Ajoute un beat sans réordonner implicitement les beats existants.
 */
export function addNarrativeArcStage(
  arc: NarrativeArc,
  input: AddNarrativeArcStageInput
): NarrativeArc {
  if (arc.authorLocked) {
    throw new Error(`Narrative arc ${arc.id} is author-locked`);
  }

  const maxOrder = arc.stages.reduce(
    (max, stage) => Math.max(max, stage.order),
    -1
  );
  const order = input.order ?? maxOrder + 1;
  if (arc.stages.some((stage) => stage.order === order)) {
    throw new Error(`Narrative arc stage order '${order}' already exists`);
  }

  const now = new Date().toISOString();
  const stage = NarrativeArcStageSchema.parse({
    id: crypto.randomUUID(),
    ...input,
    order,
    appearance: input.appearance ?? "present",
    sceneRefs: input.sceneRefs ?? [],
    status: input.status ?? "planned",
    authorLocked: input.authorLocked ?? false,
    createdAt: now,
    updatedAt: now,
  });

  return NarrativeArcSchema.parse({
    ...arc,
    stages: [...arc.stages, stage].sort((left, right) => left.order - right.order),
    updatedAt: now,
  });
}

export interface UpdateNarrativeArcStageInput {
  label?: string;
  kind?: NarrativeArcStageKind;
  narrativeFunction?: string;
  resultingState?: NarrativeArcStateInput;
  frameworkBeat?: string;
  pressure?: string;
  choiceOrResponse?: string;
  transformation?: string;
  appearance?: NarrativeArcAppearance;
  sceneRefs?: string[];
  presentation?: NarrativePresentationInput;
  status?: NarrativeArcStageStatus;
  authorLocked?: boolean;
}

export function updateNarrativeArcStage(
  arc: NarrativeArc,
  stageId: string,
  patch: UpdateNarrativeArcStageInput
): NarrativeArc {
  if (arc.authorLocked) {
    throw new Error(`Narrative arc ${arc.id} is author-locked`);
  }

  const current = arc.stages.find((stage) => stage.id === stageId);
  if (!current) {
    throw new Error(`Narrative arc stage '${stageId}' not found`);
  }
  if (current.authorLocked) {
    throw new Error(`Narrative arc stage ${stageId} is author-locked`);
  }

  const now = new Date().toISOString();
  const updated = NarrativeArcStageSchema.parse({
    ...current,
    ...patch,
    id: current.id,
    order: current.order,
    createdAt: current.createdAt,
    updatedAt: now,
  });

  return NarrativeArcSchema.parse({
    ...arc,
    stages: arc.stages.map((stage) =>
      stage.id === stageId ? updated : stage
    ),
    updatedAt: now,
  });
}

export interface NarrativeArcFinding {
  code:
    | "no-stages"
    | "missing-framework-beat"
    | "framework-beat-order"
    | "no-climax"
    | "unresolved-target"
    | "no-scene-reference"
    | "psychology-on-non-character";
  severity: "info" | "warning" | "blocking";
  message: string;
  stageId?: string;
  frameworkBeat?: string;
}

export interface NarrativeArcProgress {
  totalStages: number;
  committedStages: number;
  progress: number;
  currentStageId?: string;
  nextStageId?: string;
  resolved: boolean;
}

/**
 * Projection pure de progression ; aucun score littéraire opaque.
 */
export function deriveNarrativeArcProgress(
  arc: NarrativeArc
): NarrativeArcProgress {
  const ordered = [...arc.stages].sort((left, right) => left.order - right.order);
  const committed = ordered.filter((stage) => stage.status === "committed");
  const current = [...ordered]
    .reverse()
    .find((stage) => stage.status === "committed" || stage.status === "observed");
  const next = ordered.find(
    (stage) => stage.status === "planned" && (!current || stage.order > current.order)
  );

  return {
    totalStages: ordered.length,
    committedStages: committed.length,
    progress: ordered.length === 0 ? 0 : committed.length / ordered.length,
    currentStageId: current?.id,
    nextStageId: next?.id,
    resolved: arc.status === "resolved",
  };
}

export function getNarrativeFrameworkTemplate(
  framework: Exclude<NarrativeFramework, "custom">
): NarrativeFrameworkTemplate {
  return NARRATIVE_FRAMEWORK_TEMPLATES[framework];
}

/**
 * Audit déterministe : vérifie la cohérence structurelle sans juger la qualité
 * du texte. Les templates sont des repères ; leurs absences sont donc des
 * warnings et non des violations bloquantes.
 */
export function evaluateNarrativeArc(arc: NarrativeArc): NarrativeArcFinding[] {
  const findings: NarrativeArcFinding[] = [];
  const ordered = [...arc.stages].sort((left, right) => left.order - right.order);

  if (ordered.length === 0) {
    findings.push({
      code: "no-stages",
      severity: "warning",
      message: "Narrative arc has no stages yet",
    });
    return findings;
  }

  if (
    arc.subject.kind !== "character" &&
    arc.subject.kind !== "narrator" &&
    arc.psychologicalFunction
  ) {
    findings.push({
      code: "psychology-on-non-character",
      severity: "info",
      message:
        "A psychological function is attached to a non-character subject; keep it only if the anthropomorphic reading is intentional",
    });
  }

  if (!ordered.some((stage) => stage.kind === "climax")) {
    findings.push({
      code: "no-climax",
      severity: "warning",
      message:
        "Narrative arc has no explicit climax; this can be intentional for flat, circular or deliberately anti-climactic arcs",
    });
  }

  for (const stage of ordered) {
    if (
      (stage.status === "observed" || stage.status === "committed") &&
      stage.sceneRefs.length === 0
    ) {
      findings.push({
        code: "no-scene-reference",
        severity: "warning",
        message: `Observed stage '${stage.label}' has no scene reference`,
        stageId: stage.id,
      });
    }
  }

  if (arc.framework !== "custom") {
    const template = NARRATIVE_FRAMEWORK_TEMPLATES[arc.framework];
    const positions = new Map(
      template.beats.map((beat, index) => [beat.key, index] as const)
    );
    const presentBeats = new Set(
      ordered
        .map((stage) => stage.frameworkBeat)
        .filter((beat): beat is string => beat !== undefined)
    );

    for (const beat of template.beats) {
      if (!presentBeats.has(beat.key)) {
        findings.push({
          code: "missing-framework-beat",
          severity: "warning",
          message: `Framework beat '${beat.label}' is not represented`,
          frameworkBeat: beat.key,
        });
      }
    }

    let lastTemplatePosition = -1;
    for (const stage of ordered) {
      if (!stage.frameworkBeat) continue;
      const position = positions.get(stage.frameworkBeat);
      if (position === undefined) continue;
      if (position < lastTemplatePosition) {
        findings.push({
          code: "framework-beat-order",
          severity: "warning",
          message: `Framework beat '${stage.frameworkBeat}' appears out of template order`,
          stageId: stage.id,
          frameworkBeat: stage.frameworkBeat,
        });
      }
      lastTemplatePosition = Math.max(lastTemplatePosition, position);
    }
  }

  if (arc.status === "resolved" && arc.targetState) {
    const lastCommitted = [...ordered]
      .reverse()
      .find((stage) => stage.status === "committed");
    if (!lastCommitted) {
      findings.push({
        code: "unresolved-target",
        severity: "blocking",
        message: "A resolved arc with a target state requires a committed final stage",
      });
    }
  }

  return findings;
}
