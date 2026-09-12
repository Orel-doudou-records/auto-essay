import { z } from "zod";
import type { PlanningBrief } from "../domain/planningBrief.js";
import type { DiffractiveReading } from "../domain/diffractiveReading.js";
import type { StructuredModelClient } from "../evaluation/evaluateEssay.js";
import { createDiffractiveReader } from "./diffractiveReader.js";

export const PlanningStructuralLevelSchema = z.enum([
  "manuscript",
  "part",
  "chapter",
  "section",
  "paragraph",
]);
export type PlanningStructuralLevel = z.infer<typeof PlanningStructuralLevelSchema>;

export const HypothesisTreatmentKindSchema = z.enum([
  "test",
  "confront",
  "keep_open",
  "reject",
  "blocked_by_gap",
]);
export type HypothesisTreatmentKind = z.infer<typeof HypothesisTreatmentKindSchema>;

export const ProposedHypothesisTreatmentSchema = z.object({
  hypothesisIndex: z.number().int().nonnegative(),
  kind: HypothesisTreatmentKindSchema,
  gapIndex: z.number().int().nonnegative().optional(),
  rationale: z.string().min(1),
}).superRefine((treatment, context) => {
  if (treatment.kind === "blocked_by_gap" && treatment.gapIndex === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["gapIndex"],
      message: "blocked_by_gap requires a gapIndex",
    });
  }
  if (treatment.kind !== "blocked_by_gap" && treatment.gapIndex !== undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["gapIndex"],
      message: "gapIndex is only valid for blocked_by_gap",
    });
  }
});

export const ProposedPlanningChildSchema = z.object({
  title: z.string().min(1),
  level: PlanningStructuralLevelSchema,
  rationale: z.string().min(1),
  inheritedConstraintRefs: z.array(z.number().int().nonnegative()).default([]),
  hypothesisTreatments: z.array(ProposedHypothesisTreatmentSchema).default([]),
});
export type ProposedPlanningChild = z.infer<typeof ProposedPlanningChildSchema>;

export const PlanningArchitectureProposalSchema = z.object({
  nextLevel: PlanningStructuralLevelSchema,
  structuralDecision: z.string().min(1),
  whyDifferent: z.string().min(1).optional(),
  children: z.array(ProposedPlanningChildSchema).min(1),
});
export type PlanningArchitectureProposal = z.infer<typeof PlanningArchitectureProposalSchema>;

const RawPlanningDecompositionSchema = z.object({
  architectures: z.array(PlanningArchitectureProposalSchema).min(1).max(4),
});

export interface AdaptivePlanningDecomposition {
  scopeBriefId: string;
  architectures: PlanningArchitectureProposal[];
}

const LEVEL_RANK: Record<PlanningStructuralLevel, number> = {
  manuscript: 0,
  part: 1,
  chapter: 2,
  section: 3,
  paragraph: 4,
};

export function buildAdaptiveDecompositionPrompt(brief: PlanningBrief): string {
  return `Tu proposes une décomposition éditoriale TEMPORAIRE pour AutoEssay. Tu ne modifies jamais le manuscrit canonique.

## Scope courant
${JSON.stringify({
  scope: brief.scopeRef,
  intention: brief.intention,
  question: brief.question,
  angleOrFunction: brief.angleOrFunction,
  hypotheses: brief.hypotheses,
  gaps: brief.gaps,
  constraints: brief.constraints,
  sourceRefs: brief.sourceRefs,
}, null, 2)}

## Règles impératives
- Les niveaux possibles sont manuscript, part, chapter, section, paragraph et peuvent être sautés.
- Choisis le prochain niveau structurel réellement utile ; n'applique pas une chaîne fixe.
- Une seule architecture est le défaut. N'en propose plusieurs que si une décision structurante réelle justifie des formes différentes.
- Chaque enfant doit avoir une raison d'exister.
- Pour chaque hypothèse pertinente, indique si l'enfant la teste, la confronte, la garde ouverte, la rejette, ou si elle reste bloquée par une lacune.
- Une hypothèse under_documented ne devient jamais une assertion stabilisée.
- Référence les contraintes parentes par leur INDEX dans inheritedConstraintRefs ; ne recopie pas leur texte.
- Si un traitement est blocked_by_gap, référence l'index de la lacune concernée.

## JSON strict
{
  "architectures": [
    {
      "nextLevel": "part|chapter|section|paragraph",
      "structuralDecision": "décision structurante portée par cette architecture",
      "whyDifferent": "obligatoire uniquement si plusieurs architectures sont proposées",
      "children": [
        {
          "title": "titre de travail",
          "level": "part|chapter|section|paragraph",
          "rationale": "pourquoi cet enfant existe",
          "inheritedConstraintRefs": [0],
          "hypothesisTreatments": [
            {
              "hypothesisIndex": 0,
              "kind": "test|confront|keep_open|reject|blocked_by_gap",
              "gapIndex": 0,
              "rationale": "raison"
            }
          ]
        }
      ]
    }
  ]
}`;
}

export async function proposeAdaptiveDecomposition(
  brief: PlanningBrief,
  client: StructuredModelClient
): Promise<AdaptivePlanningDecomposition> {
  const raw = await client.generateJson(buildAdaptiveDecompositionPrompt(brief));
  const parsed = RawPlanningDecompositionSchema.parse(raw);
  validateArchitecturesAgainstBrief(brief, parsed.architectures);
  return { scopeBriefId: brief.id, architectures: parsed.architectures };
}

function validateArchitecturesAgainstBrief(
  brief: PlanningBrief,
  architectures: PlanningArchitectureProposal[]
): void {
  const parentLevel = inferScopeLevel(brief);
  const decisions = new Set<string>();

  for (const [architectureIndex, architecture] of architectures.entries()) {
    if (LEVEL_RANK[architecture.nextLevel] <= LEVEL_RANK[parentLevel]) {
      throw new Error(
        `Architecture ${architectureIndex} must decompose below parent level ${parentLevel}`
      );
    }
    for (const child of architecture.children) {
      if (child.level !== architecture.nextLevel) {
        throw new Error(
          `Architecture ${architectureIndex} mixes child level ${child.level} with nextLevel ${architecture.nextLevel}`
        );
      }
      for (const constraintIndex of child.inheritedConstraintRefs) {
        if (constraintIndex >= brief.constraints.length) {
          throw new Error(`Unknown parent constraint index ${constraintIndex}`);
        }
      }
      for (const treatment of child.hypothesisTreatments) {
        if (treatment.hypothesisIndex >= brief.hypotheses.length) {
          throw new Error(`Unknown hypothesis index ${treatment.hypothesisIndex}`);
        }
        if (treatment.gapIndex !== undefined && treatment.gapIndex >= brief.gaps.length) {
          throw new Error(`Unknown gap index ${treatment.gapIndex}`);
        }
        const hypothesis = brief.hypotheses[treatment.hypothesisIndex];
        if (
          hypothesis?.status === "under_documented" &&
          treatment.kind !== "keep_open" &&
          treatment.kind !== "blocked_by_gap" &&
          treatment.kind !== "confront"
        ) {
          throw new Error(
            `Under-documented hypothesis ${treatment.hypothesisIndex} cannot be stabilized by decomposition`
          );
        }
      }
    }

    const normalizedDecision = architecture.structuralDecision.trim().toLowerCase();
    if (decisions.has(normalizedDecision)) {
      throw new Error("Multiple architectures must differ on a real structural decision");
    }
    decisions.add(normalizedDecision);
  }

  if (architectures.length > 1) {
    for (const architecture of architectures) {
      if (!architecture.whyDifferent?.trim()) {
        throw new Error("Alternative architectures require whyDifferent");
      }
    }
  }
}

/**
 * Scope kinds deliberately remain coarse. A node can represent part/chapter/section;
 * its semantic role stays transient until a real consumer requires persistence.
 */
function inferScopeLevel(brief: PlanningBrief): PlanningStructuralLevel {
  if (brief.scopeRef.kind === "manuscript") return "manuscript";
  if (brief.scopeRef.kind === "plan_entry") return "paragraph";
  return "part";
}

/**
 * Decision-point review before any future stabilization. This reuses the existing
 * Diffract reader and treats the proposal as advisory material, never as a second tree.
 */
export async function diffractDecompositionProposal(
  brief: PlanningBrief,
  proposal: PlanningArchitectureProposal,
  client: StructuredModelClient
): Promise<DiffractiveReading> {
  return createDiffractiveReader(client).read({
    statement: [
      `Décomposition proposée pour le scope ${brief.scopeRef.kind}.`,
      `Décision structurante: ${proposal.structuralDecision}.`,
      ...proposal.children.map(
        (child) => `${child.level}: ${child.title} — ${child.rationale}`
      ),
    ].join("\n"),
    sourceIds: brief.sourceRefs,
  });
}
