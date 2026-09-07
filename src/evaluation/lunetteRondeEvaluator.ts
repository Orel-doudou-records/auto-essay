import { z } from "zod";
import type { DraftUnit } from "../domain/draftUnit";
import type { StructuredModelClient } from "./evaluateEssay";

const NonEmptyTextSchema = z.string().trim().min(1);

export const LunetteRondeModeSchema = z.enum(["lite", "full", "ultra"]);
export type LunetteRondeMode = z.infer<typeof LunetteRondeModeSchema>;

export const LunetteRondeInterventionKindSchema = z.enum([
  "cut",
  "clarify",
  "concretize",
  "rhythm",
  "genericity",
  "syntax",
]);

export const LunetteRondeFindingKindSchema = z.enum([
  ...LunetteRondeInterventionKindSchema.options,
  "keep",
  "open_question",
]);

export const LunetteRondeEvidenceSchema = z
  .object({ excerpt: NonEmptyTextSchema })
  .strict();

const LunetteRondeFindingBaseSchema = z
  .object({
    evidence: LunetteRondeEvidenceSchema,
    diagnosis: NonEmptyTextSchema,
  })
  .strict();

export const LunetteRondeInterventionFindingSchema =
  LunetteRondeFindingBaseSchema.extend({
    kind: LunetteRondeInterventionKindSchema,
    suggestion: NonEmptyTextSchema,
  });

export const LunetteRondeOpenQuestionFindingSchema =
  LunetteRondeFindingBaseSchema.extend({
    kind: z.literal("open_question"),
    authorQuestion: NonEmptyTextSchema,
  });

export const LunetteRondeKeepFindingSchema =
  LunetteRondeFindingBaseSchema.extend({ kind: z.literal("keep") });

export const LunetteRondeFindingSchema = z.union([
  LunetteRondeInterventionFindingSchema,
  LunetteRondeOpenQuestionFindingSchema,
  LunetteRondeKeepFindingSchema,
]);

export const LunetteRondeReviewSchema = z
  .object({
    mode: LunetteRondeModeSchema,
    findings: z.array(LunetteRondeFindingSchema).default([]),
  })
  .strict();
export type LunetteRondeReview = z.infer<typeof LunetteRondeReviewSchema>;

export class LunetteRondeEvaluator {
  constructor(private readonly client: StructuredModelClient) {}

  async evaluate(
    unit: DraftUnit,
    mode: LunetteRondeMode = "full"
  ): Promise<LunetteRondeReview> {
    const resolvedMode = LunetteRondeModeSchema.parse(mode);
    const raw = await this.client.generateJson(
      buildEssayLunetteRondePrompt(unit, resolvedMode)
    );
    const review = LunetteRondeReviewSchema.parse(raw);

    if (review.mode !== resolvedMode) {
      throw new Error(
        `Lunette Ronde returned mode ${review.mode} for ${resolvedMode}`
      );
    }

    for (const finding of review.findings) {
      if (!unit.content.includes(finding.evidence.excerpt)) {
        throw new Error(
          `Lunette Ronde evidence is absent from unit ${unit.id}: ${finding.evidence.excerpt}`
        );
      }
    }

    return review;
  }
}

export function createLunetteRondeEvaluator(
  client: StructuredModelClient
): LunetteRondeEvaluator {
  return new LunetteRondeEvaluator(client);
}

export function buildEssayLunetteRondePrompt(
  unit: DraftUnit,
  mode: LunetteRondeMode = "full"
): string {
  const resolvedMode = LunetteRondeModeSchema.parse(mode);
  const modeGuidance: Record<LunetteRondeMode, string> = {
    lite: "Signale seulement les lourdeurs évidentes ; préserve presque toute la structure.",
    full: "Clarifie, coupe et réordonne avec mesure sans effacer la voix.",
    ultra:
      "Interviens franchement quand le passage ne tient pas et transforme le flou irréductible en question d'auteur.",
  };

  return `Tu es Lunette Ronde, lecteur éditorial discret qui n'est pas dupe.

Lis l'unité entière avant de juger une phrase. L'intervention minimale vient après la compréhension.
Cherche la cause, pas le symptôme : idée mal ordonnée, concept non défini, relation logique absente, abstraction sans référent, répétition ou sur-explication.
Préserve le sens, les faits fournis, le degré de certitude, les citations, les distinctions conceptuelles, les contraintes éditoriales et la voix de l'auteur.
Ne transforme jamais une prudence justifiée en certitude et n'invente ni fait, ni source, ni intention.
Une phrase plus courte mais moins exacte est une mauvaise correction.
Si une correction honnête exige une information absente ou une décision d'auteur, retourne open_question avec une question précise et sans suggestion de correction.
keep est valide quand le passage tient déjà.
Décris seulement des phénomènes observables ; ne déduis jamais une origine humaine ou IA.
Mode ${resolvedMode}: ${modeGuidance[resolvedMode]}

## Texte
\`\`\`
${unit.content}
\`\`\`

## JSON strict
{
  "mode": "${resolvedMode}",
  "findings": [
    {
      "kind": "cut|clarify|concretize|rhythm|genericity|syntax|keep|open_question",
      "evidence": { "excerpt": "extrait exact" },
      "diagnosis": "constat situé",
      "suggestion": "obligatoire uniquement pour cut|clarify|concretize|rhythm|genericity|syntax",
      "authorQuestion": "obligatoire uniquement pour open_question"
    }
  ]
}`;
}
