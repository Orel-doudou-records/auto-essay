import {
  LunetteRondeModeSchema,
  LunetteRondeReviewSchema,
  buildLunetteRondeInstructions,
  type LunetteRondeMode,
  type LunetteRondeReview,
} from "writing-engine";
import type { DraftUnit } from "../domain/draftUnit";
import type { StructuredModelClient } from "./evaluateEssay";

export type { LunetteRondeMode, LunetteRondeReview } from "writing-engine";

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

export function buildEssayLunetteRondePrompt(
  unit: DraftUnit,
  mode: LunetteRondeMode = "full"
): string {
  const resolvedMode = LunetteRondeModeSchema.parse(mode);

  return `${buildLunetteRondeInstructions(resolvedMode)}

Contexte AutoEssay :
- Préserve les citations, les distinctions conceptuelles et le degré d'incertitude des assertions.
- Ne transforme jamais une prudence justifiée en certitude.
- N'invente ni fait, ni source, ni intention d'auteur.
- Une amélioration formelle ne peut pas compenser une perte d'intégrité documentaire.

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
