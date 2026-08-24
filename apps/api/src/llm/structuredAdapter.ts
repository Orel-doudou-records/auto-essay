import type { StructuredModelClient } from "@auto-essay/core";
import type { ModelClient } from "./client.js";
import { parseJsonRobustly } from "./jsonRepair.js";

const JSON_SYSTEM =
  "Tu es un assistant qui répond toujours en JSON valide, sans balises de code, sans texte explicatif.";

const REPAIR_SYSTEM =
  "Tu es un assistant qui répond uniquement en JSON valide. Corrige le JSON fourni pour qu'il soit syntaxiquement valide, sans balises de code ni texte explicatif.";

export interface StructuredAdapterOptions {
  /** Nombre de nouvelles tentatives en cas de JSON invalide (défaut : 1). */
  maxRetries?: number;
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export class StructuredClientAdapter implements StructuredModelClient {
  constructor(
    private readonly client: ModelClient,
    private readonly options: StructuredAdapterOptions = {}
  ) {}

  async generateJson(prompt: string): Promise<unknown> {
    const maxRetries = this.options.maxRetries ?? 1;
    let lastRaw = "";
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const isRetry = attempt > 0;
      const system = isRetry ? REPAIR_SYSTEM : JSON_SYSTEM;
      const user = isRetry
        ? `${prompt}\n\nTa réponse précédente n'était pas du JSON valide.\nRéponse précédente :\n${lastRaw}\n\nErreur : ${describeError(lastError)}`
        : prompt;

      lastRaw = await this.client.complete(system, user);
      try {
        return parseJsonRobustly(lastRaw);
      } catch (err) {
        lastError = err;
      }
    }

    throw new Error(
      `Réponse non-JSON après ${maxRetries + 1} tentatives : ${describeError(lastError)}`
    );
  }
}
