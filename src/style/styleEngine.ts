import type { StructuredModelClient } from "../evaluation/evaluateEssay";
import {
  DiffractiveStylePlanSchema,
  StyleProfileSchema,
  type DiffractiveStylePlan,
  type StyleProfile,
} from "../domain/styleProfile";
import {
  buildDiffractiveStylePrompt,
  buildStyleAnalysisPrompt,
  type DiffractiveStyleRequest,
  type StyleAnalysisRequest,
} from "./prompts";

/**
 * LiteracraftStyleEngine orchestre deux opérations distinctes :
 * 1. analyser un texte en profil de mécanismes stylistiques ;
 * 2. diffracter ce profil avec un nouveau contexte pour produire une voix émergente.
 *
 * Il ne rédige pas lui-même. Cette séparation permet de conserver writer ≠ judge
 * et d'injecter la direction stylistique dans plusieurs granularités du pipeline.
 */
export class LiteracraftStyleEngine {
  private client: StructuredModelClient;

  constructor(client: StructuredModelClient) {
    this.client = client;
  }

  async analyze(request: StyleAnalysisRequest): Promise<StyleProfile> {
    const prompt = buildStyleAnalysisPrompt(request);
    const rawOutput = await this.client.generateJson(prompt);
    const raw = asRecord(rawOutput);

    return StyleProfileSchema.parse({
      id: crypto.randomUUID(),
      version: "1.0",
      sourceLabel: request.sourceLabel,
      createdAt: new Date().toISOString(),
      ...raw,
    });
  }

  async diffract(
    request: DiffractiveStyleRequest
  ): Promise<DiffractiveStylePlan> {
    const prompt = buildDiffractiveStylePrompt(request);
    const rawOutput = await this.client.generateJson(prompt);
    const raw = asRecord(rawOutput);

    return DiffractiveStylePlanSchema.parse({
      id: crypto.randomUUID(),
      version: "1.0",
      profileId: request.profile.id,
      createdAt: new Date().toISOString(),
      ...raw,
    });
  }
}

export function createLiteracraftStyleEngine(
  client: StructuredModelClient
): LiteracraftStyleEngine {
  return new LiteracraftStyleEngine(client);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Structured model output must be a JSON object");
  }

  return value as Record<string, unknown>;
}
