import { z } from "zod";
import type { Manuscript } from "../domain/manuscript.js";
import type { PlanningQuestionCandidate } from "../domain/planningReadiness.js";
import type { StructuredModelClient } from "../evaluation/evaluateEssay.js";
import {
  type BookBibliographyInput,
  type ExistingCutInput,
} from "./diffractiveReader.js";
import { diffractPlan } from "./planPreview.js";
import {
  projectBookPlan,
  projectBookState,
  type ProjectBookStateOptions,
} from "./projectBookState.js";

export const PlanDiagnosticKindSchema = z.enum([
  "stable",
  "fragile",
  "incomplete",
  "redundant",
  "unsupported",
  "missing_articulation",
]);

export type PlanDiagnosticKind = z.infer<typeof PlanDiagnosticKindSchema>;

export const PlanRefinementDiagnosticSchema = z.object({
  partId: z.string().min(1),
  entryId: z.string().min(1).optional(),
  kind: PlanDiagnosticKindSchema,
  reason: z.string().min(1),
});

export const PlanTransformationKindSchema = z.enum([
  "enrich",
  "add",
  "move",
  "merge",
  "split",
  "reformulate",
  "incubate",
  "mark_unresolved",
]);

export type PlanTransformationKind = z.infer<typeof PlanTransformationKindSchema>;

export const PlanTransformationCandidateSchema = z.object({
  kind: PlanTransformationKindSchema,
  partId: z.string().min(1),
  entryId: z.string().min(1).optional(),
  targetPartId: z.string().min(1).optional(),
  targetEntryId: z.string().min(1).optional(),
  current: z.string().min(1),
  proposal: z.string().min(1),
  reason: z.string().min(1),
  consequences: z.array(z.string().min(1)).default([]),
  requiresAuthorDecision: z.boolean().default(false),
  missingEvidence: z.string().min(1).optional(),
});

const RawPlanRefinementSchema = z.object({
  diagnostics: z.array(PlanRefinementDiagnosticSchema).default([]),
  transformations: z.array(PlanTransformationCandidateSchema).default([]),
  authorQuestions: z
    .array(
      z.object({
        id: z.string().min(1),
        prompt: z.string().min(1),
        impact: z.enum([
          "structure",
          "scope_meaning",
          "hypothesis",
          "documentary_dependency",
          "author_decision",
        ]),
      })
    )
    .default([]),
});

export interface RefineExistingPlanInput {
  manuscript: Manuscript;
  bookState?: ProjectBookStateOptions;
  existingCuts?: ExistingCutInput[];
  bookBibliography?: BookBibliographyInput;
}

export interface PlanRefinementResult {
  readingId: string;
  verdict: string;
  diagnostics: z.infer<typeof PlanRefinementDiagnosticSchema>[];
  transformations: z.infer<typeof PlanTransformationCandidateSchema>[];
  authorQuestions: PlanningQuestionCandidate[];
  remoteImpacts: Array<{
    partId: string;
    partTitle: string;
    entryId?: string;
    impact: string;
  }>;
}

/**
 * Advisory refinement of an existing plan. Diffract remains the sole reader:
 * the second model call only structures the already-produced reading into
 * differential candidate edits. The manuscript is never mutated here.
 */
export async function refineExistingPlan(
  input: RefineExistingPlanInput,
  client: StructuredModelClient
): Promise<PlanRefinementResult> {
  const plan = projectBookPlan(input.manuscript);
  if (plan.length === 0) {
    throw new Error("existing plan refinement requires at least one planned entry");
  }

  const reading = await diffractPlan(
    {
      plan,
      bookParts: projectBookState(input.manuscript, input.bookState),
      existingCuts: input.existingCuts,
      bookBibliography: input.bookBibliography,
    },
    client
  );

  const raw = await client.generateJson(buildRefinementPrompt(plan, reading));
  const parsed = RawPlanRefinementSchema.parse(raw);
  assertReferencesExist(plan, parsed.diagnostics, parsed.transformations);

  return {
    readingId: reading.id,
    verdict: reading.verdict,
    diagnostics: parsed.diagnostics,
    transformations: parsed.transformations,
    authorQuestions: parsed.authorQuestions.map((question) => ({
      ...question,
      wouldChangePlanning: true,
    })),
    remoteImpacts: reading.planImpacts,
  };
}

function buildRefinementPrompt(
  plan: ReturnType<typeof projectBookPlan>,
  reading: Awaited<ReturnType<typeof diffractPlan>>
): string {
  return `Tu structures une lecture diffractive déjà produite. Tu ne relis pas le livre depuis zéro et tu ne réécris pas le plan.\n\nPrincipes :\n- préserver par défaut tout élément qui n'est pas explicitement mis en cause par la lecture ;\n- proposer seulement des différences locales et argumentées ;\n- une lacune documentaire peut devenir mark_unresolved, jamais un contenu inventé ;\n- aucune mutation : tu décris des candidats ;\n- une question auteur n'est produite que si sa réponse change réellement structure, sens, hypothèse ou dépendance documentaire.\n\nPlan canonique :\n${JSON.stringify(plan, null, 2)}\n\nLecture Diffract :\n${JSON.stringify(reading, null, 2)}\n\nJSON strict :\n{\n  "diagnostics": [{"partId":"...","entryId":"... optionnel","kind":"stable|fragile|incomplete|redundant|unsupported|missing_articulation","reason":"..."}],\n  "transformations": [{"kind":"enrich|add|move|merge|split|reformulate|incubate|mark_unresolved","partId":"...","entryId":"... optionnel","targetPartId":"... optionnel","targetEntryId":"... optionnel","current":"...","proposal":"...","reason":"...","consequences":["..."],"requiresAuthorDecision":false,"missingEvidence":"... optionnel"}],\n  "authorQuestions": [{"id":"...","prompt":"...","impact":"structure|scope_meaning|hypothesis|documentary_dependency|author_decision"}]\n}`;
}

function assertReferencesExist(
  plan: ReturnType<typeof projectBookPlan>,
  diagnostics: Array<z.infer<typeof PlanRefinementDiagnosticSchema>>,
  transformations: Array<z.infer<typeof PlanTransformationCandidateSchema>>
): void {
  const partIds = new Set(plan.map((part) => part.partId));
  const entryIds = new Set(plan.flatMap((part) => part.entries.map((entry) => entry.id)));

  const assertPart = (id: string): void => {
    if (!partIds.has(id)) throw new Error(`Unknown plan part reference: ${id}`);
  };
  const assertEntry = (id: string | undefined): void => {
    if (id !== undefined && !entryIds.has(id)) {
      throw new Error(`Unknown plan entry reference: ${id}`);
    }
  };

  for (const diagnostic of diagnostics) {
    assertPart(diagnostic.partId);
    assertEntry(diagnostic.entryId);
  }
  for (const transformation of transformations) {
    assertPart(transformation.partId);
    assertEntry(transformation.entryId);
    if (transformation.targetPartId !== undefined) assertPart(transformation.targetPartId);
    assertEntry(transformation.targetEntryId);
    if (transformation.kind === "mark_unresolved" && !transformation.missingEvidence) {
      throw new Error("mark_unresolved requires missingEvidence");
    }
  }
}
