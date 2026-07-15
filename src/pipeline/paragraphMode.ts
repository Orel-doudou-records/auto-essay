import { z } from "zod";
import type { Source } from "../domain/source";
import type { EvidencePack } from "../domain/draftUnit";
import type { WriterEditorialProjection } from "../domain/editorialProjection";
import {
  createTransformationTrace,
  type TransformationTrace,
  type TransformationDeclarationInput,
} from "../domain/transformationTrace";
import type { StructuredModelClient } from "../evaluation/evaluateEssay";

const GeneratedClaimSchema = z.object({
  statement: z.string().min(1),
  confidenceLevel: z.enum([
    "certain",
    "probable",
    "speculative",
    "unsupported",
  ]),
  sourceIds: z.array(z.string()).default([]),
});

const AppliedDirectiveDeclarationSchema = z.object({
  directiveId: z.string().min(1),
  decisionId: z.string().min(1),
  articulationId: z.string().min(1),
  declaration: z.string().min(1),
  excerpt: z.string().min(1),
  start: z.number().int().nonnegative().optional(),
  end: z.number().int().positive().optional(),
});

const ParagraphModelOutputSchema = z.object({
  plan_3_sentences: z.array(z.string().min(1)).max(3).default([]),
  paragraph: z.string().min(1),
  claims: z.array(GeneratedClaimSchema).default([]),
  confidence_assessment: z.enum(["high", "medium", "low"]),
  applied_directives: z.array(AppliedDirectiveDeclarationSchema).default([]),
});

export interface ParagraphGenerationContext {
  section?: string;
  precedingText?: string;
  thesis?: string;
  unitId?: string;
  unitVersion?: number;
  editorialProjection?: WriterEditorialProjection;
}

/**
 * Résultat de génération de paragraphe.
 * Les traces sont des déclarations du writer, pas une évaluation de réussite.
 */
export interface ParagraphGenerationResult {
  content: string;
  plan: string[];
  claims: Array<{
    statement: string;
    confidenceLevel: "certain" | "probable" | "speculative" | "unsupported";
    sourceIds: string[];
  }>;
  confidenceAssessment: "high" | "medium" | "low";
  appliedDecisionIds: string[];
  appliedArticulationIds: string[];
  transformationTraces: TransformationTrace[];
}

/**
 * Générateur de paragraphes.
 * Le mode historique reste disponible sans projection éditoriale.
 */
export class ParagraphGenerator {
  constructor(private readonly client: StructuredModelClient) {}

  async generateParagraph(
    evidencePack: EvidencePack,
    sources: Source[],
    context?: ParagraphGenerationContext
  ): Promise<ParagraphGenerationResult> {
    validateGenerationInputs(evidencePack, sources, context);
    const prompt = this.buildParagraphPrompt(evidencePack, sources, context);
    const rawOutput = await this.client.generateJson(prompt);
    return this.parseParagraphOutput(rawOutput, evidencePack, context);
  }

  private buildParagraphPrompt(
    evidencePack: EvidencePack,
    sources: Source[],
    context?: ParagraphGenerationContext
  ): string {
    const sourcesList = evidencePack.sourceIds
      .map((id) => sources.find((source) => source.id === id))
      .filter((source): source is Source => source !== undefined)
      .map(
        (source) =>
          `- ${source.title} (${source.authors.join(", ")})\n  Citations clés:\n${source.annotations
            .map(
              (annotation) =>
                `    - "${annotation.content}"${
                  annotation.pageRange ? ` (p. ${annotation.pageRange})` : ""
                }`
            )
            .join("\n")}`
      )
      .join("\n\n");

    const keyCitations = evidencePack.keyCitations
      .map(
        (citation) =>
          `- "${citation.quote}"${
            citation.pageRange ? ` (p. ${citation.pageRange})` : ""
          }${citation.context ? `\n  Contexte: ${citation.context}` : ""}`
      )
      .join("\n");

    const editorialSection = context?.editorialProjection
      ? renderWriterProjection(context.editorialProjection)
      : "";

    return `Tu travailles en mode PARAGRAPHE.

## Objectif
Intégrer les sources fournies dans un paragraphe cohérent de 180-220 mots, sans sur-interpréter.

${context?.thesis ? `## Thèse du projet\n${context.thesis}` : ""}
${context?.section ? `## Section\n${context.section}` : ""}
${context?.precedingText ? `## Texte précédent\n${context.precedingText}\n` : ""}
${editorialSection}

## Evidence Pack

### Sources
${sourcesList || "Aucune source"}

### Citations clés à intégrer
${keyCitations || "Aucune citation spécifiée"}

${evidencePack.authorNotes ? `### Notes de l'auteur\n${evidencePack.authorNotes}` : ""}

## Contraintes absolues
1. 180-220 mots exactement
2. Maximum 2 citations directes
3. Toutes les citations DOIVENT venir de l'evidence pack
4. Distinguer explicitement : fait / interprétation / hypothèse
5. Si une affirmation n'est pas prouvée, utiliser un verbe modal (suggère, indique, semble)
6. Pas d'assertion forte ("démontre", "prouve") sans source solide
7. Une directive éditoriale ne peut jamais autoriser une nouvelle source ou un nouveau claim

## Format de sortie JSON strict
{
  "plan_3_sentences": ["string", "string", "string"],
  "paragraph": "string (180-220 mots)",
  "claims": [
    {
      "statement": "string",
      "confidenceLevel": "certain|probable|speculative|unsupported",
      "sourceIds": ["source-id"]
    }
  ],
  "confidence_assessment": "high|medium|low",
  "applied_directives": [
    {
      "directiveId": "directive-id fourni",
      "decisionId": "decision-id fourni",
      "articulationId": "articulation-id fourni",
      "declaration": "description factuelle de l'opération tentée",
      "excerpt": "extrait exact du paragraphe",
      "start": 0,
      "end": 10
    }
  ]
}

Le champ applied_directives reste vide en mode historique. En mode éditorial, il ne doit contenir que les opérations réellement tentées et des extraits exacts du paragraphe. Il ne constitue pas une auto-évaluation.`;
  }

  private parseParagraphOutput(
    rawOutput: unknown,
    evidencePack: EvidencePack,
    context?: ParagraphGenerationContext
  ): ParagraphGenerationResult {
    const parsed = ParagraphModelOutputSchema.parse(rawOutput);
    const allowedSourceIds = new Set(evidencePack.sourceIds);

    for (const claim of parsed.claims) {
      for (const sourceId of claim.sourceIds) {
        if (!allowedSourceIds.has(sourceId)) {
          throw new Error(`Generated claim references unknown source ${sourceId}`);
        }
      }
    }

    if (!context?.editorialProjection && parsed.applied_directives.length > 0) {
      throw new Error(
        "Historical paragraph mode cannot declare editorial transformations"
      );
    }

    const traces = context?.editorialProjection
      ? createTraces(
          parsed.paragraph,
          context.unitId!,
          context.unitVersion!,
          context.editorialProjection,
          parsed.applied_directives
        )
      : [];

    return {
      content: parsed.paragraph,
      plan: parsed.plan_3_sentences,
      claims: parsed.claims,
      confidenceAssessment: parsed.confidence_assessment,
      appliedDecisionIds: unique(traces.map((trace) => trace.decisionId)),
      appliedArticulationIds: unique(
        traces.map((trace) => trace.articulationId)
      ),
      transformationTraces: traces,
    };
  }
}

export function createParagraphGenerator(
  client: StructuredModelClient
): ParagraphGenerator {
  return new ParagraphGenerator(client);
}

function validateGenerationInputs(
  evidencePack: EvidencePack,
  sources: Source[],
  context?: ParagraphGenerationContext
): void {
  const sourceCatalog = new Set(sources.map((source) => source.id));

  for (const sourceId of evidencePack.sourceIds) {
    if (!sourceCatalog.has(sourceId)) {
      throw new Error(`Evidence pack references missing source ${sourceId}`);
    }
  }

  const projection = context?.editorialProjection;
  if (!projection) {
    return;
  }

  if (!context?.unitId || !context.unitVersion) {
    throw new Error("Editorial paragraph generation requires unitId and unitVersion");
  }
  if (
    projection.unitId !== context.unitId ||
    projection.unitVersion !== context.unitVersion
  ) {
    throw new Error("Writer projection does not match paragraph unit");
  }

  const sourceIds = new Set(evidencePack.sourceIds);
  for (const evidenceId of projection.allowedEvidenceIds) {
    if (!sourceIds.has(evidenceId)) {
      throw new Error(
        `Writer projection introduces evidence outside the evidence pack: ${evidenceId}`
      );
    }
  }

  const claimIds = new Set(evidencePack.supportingClaimIds);
  for (const claimId of projection.allowedClaimIds) {
    if (!claimIds.has(claimId)) {
      throw new Error(
        `Writer projection introduces claim outside the evidence pack: ${claimId}`
      );
    }
  }
}

function renderWriterProjection(projection: WriterEditorialProjection): string {
  const directives = projection.directives
    .map(
      (directive) =>
        `- [${directive.id}] (${directive.kind}) ${directive.instruction}\n  decision=${directive.decisionId}; articulation=${directive.articulationId}`
    )
    .join("\n");

  return `## Plan éditorial validé
Fonction argumentative : ${projection.argumentativeFunction}
Claims autorisés : ${projection.allowedClaimIds.join(", ") || "aucun"}
Preuves autorisées : ${projection.allowedEvidenceIds.join(", ") || "aucune"}
Relations documentaires : ${
    projection.allowedSourceRelationIds.join(", ") || "aucune"
  }

### Directives
${directives}

### Effets recherchés
- Contenu : ${projection.intendedEffects.content.join(" | ")}
- Forme : ${projection.intendedEffects.form.join(" | ")}`;
}

function createTraces(
  content: string,
  unitId: string,
  unitVersion: number,
  projection: WriterEditorialProjection,
  declarations: z.infer<typeof AppliedDirectiveDeclarationSchema>[]
): TransformationTrace[] {
  const seenDirectiveIds = new Set<string>();

  return declarations.map((declaration) => {
    if (seenDirectiveIds.has(declaration.directiveId)) {
      throw new Error(
        `Duplicate transformation declaration for directive ${declaration.directiveId}`
      );
    }
    seenDirectiveIds.add(declaration.directiveId);

    const location = locateExcerpt(content, declaration);
    const input: TransformationDeclarationInput = {
      ...declaration,
      start: location.start,
      end: location.end,
    };

    return createTransformationTrace(
      unitId,
      unitVersion,
      projection,
      input
    );
  });
}

function locateExcerpt(
  content: string,
  declaration: z.infer<typeof AppliedDirectiveDeclarationSchema>
): { start: number; end: number } {
  if (declaration.start !== undefined || declaration.end !== undefined) {
    if (declaration.start === undefined || declaration.end === undefined) {
      throw new Error("Applied directive offsets require both start and end");
    }
    if (content.slice(declaration.start, declaration.end) !== declaration.excerpt) {
      throw new Error(
        `Applied directive excerpt does not match offsets for ${declaration.directiveId}`
      );
    }
    return { start: declaration.start, end: declaration.end };
  }

  const start = content.indexOf(declaration.excerpt);
  if (start < 0) {
    throw new Error(
      `Applied directive excerpt is absent from paragraph for ${declaration.directiveId}`
    );
  }

  return { start, end: start + declaration.excerpt.length };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
