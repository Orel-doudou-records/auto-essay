import { responseError, transportError } from "./errors.js";

export interface ModelClientRequestOptions {
  maxAttempts?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}

const DEFAULT_OPTIONS: Required<ModelClientRequestOptions> = {
  maxAttempts: 2,
  retryDelayMs: 200,
  timeoutMs: 30_000,
};

export async function requestProvider(
  provider: "openai-compatible" | "ollama",
  url: string,
  init: RequestInit,
  options: ModelClientRequestOptions = {}
): Promise<Response> {
  const resolved = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 1; attempt <= resolved.maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(resolved.timeoutMs),
      });
      if (response.ok) {
        return response;
      }

      throw responseError(provider, response.status);
    } catch (error) {
      const normalized = transportError(provider, error);
      lastError = normalized;
      if (!normalized.retryable || attempt === resolved.maxAttempts) {
        throw normalized;
      }
      await delay(resolved.retryDelayMs);
    }
  }

  throw lastError;
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}
