import type { ModelClient } from "./client.js";
import { invalidResponseError } from "./errors.js";
import {
  requestProvider,
  type ModelClientRequestOptions,
} from "./request.js";

export class OllamaClient implements ModelClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string = "https://ollama.com",
    private readonly model: string = "mistral-large-3:675b",
    private readonly requestOptions: ModelClientRequestOptions = {}
  ) {}

  async complete(system: string, user: string): Promise<string> {
    const response = await this.requestChat(system, user, false);
    let data: unknown;
    try {
      data = await response.json();
    } catch (error) {
      throw invalidResponseError("ollama", error);
    }

    const content = parseMessageContent(data);
    if (content === undefined) {
      throw invalidResponseError("ollama");
    }
    return content;
  }

  async completeStream(
    system: string,
    user: string,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const response = await this.requestChat(system, user, true);
    const reader = response.body?.getReader();
    if (!reader) {
      throw invalidResponseError("ollama");
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
        throw invalidResponseError("ollama", error);
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

  private requestChat(system: string, user: string, stream: boolean): Promise<Response> {
    return requestProvider(
      "ollama",
      `${this.baseUrl}/api/chat`,
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
          stream,
        }),
      },
      this.requestOptions
    );
  }
}

function parseMessageContent(data: unknown): string | undefined {
  if (!isRecord(data) || !isRecord(data.message)) {
    return undefined;
  }

  return typeof data.message.content === "string" ? data.message.content : undefined;
}

function parseStreamLine(line: string, onChunk: (chunk: string) => void): void {
  const trimmed = line.trim();
  if (!trimmed) return;

  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch (error) {
    throw invalidResponseError("ollama", error);
  }

  const content = parseMessageContent(data);
  if (content === undefined) {
    throw invalidResponseError("ollama");
  }
  if (content) onChunk(content);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
