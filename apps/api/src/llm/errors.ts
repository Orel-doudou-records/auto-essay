export type ModelClientErrorKind =
  | "authentication"
  | "rate_limited"
  | "provider_unavailable"
  | "timeout"
  | "network"
  | "response_invalid";

export class ModelClientError extends Error {
  readonly name = "ModelClientError";

  constructor(
    readonly provider: "openai-compatible" | "ollama",
    readonly kind: ModelClientErrorKind,
    readonly retryable: boolean,
    readonly status?: number,
    cause?: unknown
  ) {
    super(createMessage(provider, kind, status), { cause });
  }
}

export function responseError(
  provider: "openai-compatible" | "ollama",
  status: number
): ModelClientError {
  if (status === 401 || status === 403) {
    return new ModelClientError(provider, "authentication", false, status);
  }

  if (status === 429) {
    return new ModelClientError(provider, "rate_limited", true, status);
  }

  if (status >= 500) {
    return new ModelClientError(provider, "provider_unavailable", true, status);
  }

  return new ModelClientError(provider, "response_invalid", false, status);
}

export function transportError(
  provider: "openai-compatible" | "ollama",
  error: unknown
): ModelClientError {
  if (error instanceof ModelClientError) {
    return error;
  }

  if (error instanceof DOMException && error.name === "TimeoutError") {
    return new ModelClientError(provider, "timeout", true, undefined, error);
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return new ModelClientError(provider, "timeout", true, undefined, error);
  }

  return new ModelClientError(provider, "network", true, undefined, error);
}

export function invalidResponseError(
  provider: "openai-compatible" | "ollama",
  cause?: unknown
): ModelClientError {
  return new ModelClientError(provider, "response_invalid", false, undefined, cause);
}

function createMessage(
  provider: "openai-compatible" | "ollama",
  kind: ModelClientErrorKind,
  status?: number
): string {
  const prefix = provider === "ollama" ? "Ollama" : "OpenAI-compatible";
  const suffix = status === undefined ? "" : ` (HTTP ${status})`;
  return `${prefix} request failed: ${kind}${suffix}`;
}
