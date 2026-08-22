import type { ModelClient } from "./client.js";

/**
 * Adaptateur Ollama Cloud (API native /api/chat).
 * Authentification par clé API (Bearer). Base par défaut : https://ollama.com.
 * Modèle configurable via OLLAMA_MODEL (défaut : mistral-large-3:675b).
 */
export class OllamaClient implements ModelClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string = "https://ollama.com",
    private readonly model: string = "mistral-large-3:675b"
  ) {}

  async complete(system: string, user: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        stream: false,
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama error ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as { message?: { content?: string } };
    return data.message?.content ?? "";
  }

  async completeStream(
    system: string,
    user: string,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        stream: true,
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama error ${res.status}: ${await res.text()}`);
    }

    const reader = res.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const json = JSON.parse(trimmed) as {
            message?: { content?: string };
          };
          const chunk = json.message?.content;
          if (chunk) onChunk(chunk);
        } catch {
          // ignore les lignes mal formées
        }
      }
    }
  }
}
