import type { StructuredModelClient } from "@auto-essay/core";
import type { ModelClient } from "./client.js";

export class StructuredClientAdapter implements StructuredModelClient {
  constructor(private readonly client: ModelClient) {}

  async generateJson(prompt: string): Promise<unknown> {
    const system =
      "Tu es un assistant qui répond toujours en JSON valide, sans balises de code, sans texte explicatif.";
    const raw = await this.client.complete(system, prompt);
    const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
    return JSON.parse(cleaned);
  }
}
