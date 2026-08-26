import type { ModelClient } from "./client.js";
import { invalidResponseError } from "./errors.js";
import {
  requestProvider,
  type ModelClientRequestOptions,
} from "./request.js";

export class OpenAiClient implements ModelClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string = "https://api.openai.com/v1",
    private readonly model: string = "gpt-4o-mini",
    private readonly requestOptions: ModelClientRequestOptions = {}
  ) {}

  async complete(system: string, user: string): Promise<string> {
    const response = await this.requestCompletion(system, user, false);
    let data: unknown;
    try {
      data = await response.json();
    } catch (error) {
      throw invalidResponseError("openai-compatible", error);
    }

    const content = parseCompletionContent(data);
    if (content === undefined) {
      throw invalidResponseError("openai-compatible");
    }
    return content;
  }

  async completeStream(
    system: string,
    user: string,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const response = await this.requestCompletion(system, user, true);
    const reader = response.body?.getReader();
    if (!reader) {
      throw invalidResponseError("openai-compatible");
    }

    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      let chunk: Uint8Array | undefined;
      try {
        const result = await reader.read();
        if (result.done) break;
        chunk = result.value;
      } catch (error) {
        throw invalidResponseError("openai-compatible", error);
      }

      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        parseStreamLine(line, onChunk);
      }
    }

    if (buffer.trim()) {
      parseStreamLine(buffer, onChunk);
    }
  }

  private requestCompletion(
    system: string,
    user: string,
    stream: boolean
  ): Promise<Response> {
    return requestProvider(
      "openai-compatible",
      `${this.baseUrl}/chat/completions`,
      {
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
          ...(stream ? { stream: true } : {}),
          temperature: 0.7,
        }),
      },
      this.requestOptions
    );
  }
}

function parseCompletionContent(data: unknown): string | undefined {
  if (!isRecord(data) || !Array.isArray(data.choices)) {
    return undefined;
  }

  const firstChoice = data.choices[0];
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) {
    return undefined;
  }

  return typeof firstChoice.message.content === "string"
    ? firstChoice.message.content
    : undefined;
}

function parseStreamLine(line: string, onChunk: (chunk: string) => void): void {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith(":")) return;
  if (!trimmed.startsWith("data: ")) return;

  const payload = trimmed.slice(6);
  if (payload === "[DONE]") return;

  let data: unknown;
  try {
    data = JSON.parse(payload);
  } catch (error) {
    throw invalidResponseError("openai-compatible", error);
  }

  if (!isRecord(data) || !Array.isArray(data.choices)) {
    throw invalidResponseError("openai-compatible");
  }

  const firstChoice = data.choices[0];
  if (!isRecord(firstChoice) || !isRecord(firstChoice.delta)) {
    throw invalidResponseError("openai-compatible");
  }

  const content = firstChoice.delta.content;
  if (content !== undefined && typeof content !== "string") {
    throw invalidResponseError("openai-compatible");
  }
  if (content) onChunk(content);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
