import { z } from "zod";

const ProviderSchema = z.enum(["mock", "ollama", "openai-compatible"]);

const RuntimeEnvironmentSchema = z.object({
  AUTO_ESSAY_LLM_PROVIDER: ProviderSchema.optional(),
  OLLAMA_API_KEY: z.string().min(1).optional(),
  OLLAMA_BASE_URL: z.string().url().optional(),
  OLLAMA_MODEL: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_BASE_URL: z.string().url().optional(),
  OPENAI_API_BASE: z.string().url().optional(),
  OPENAI_MODEL: z.string().min(1).optional(),
  PORT: z.string().regex(/^\d+$/).optional(),
  AUTO_ESSAY_DATA_DIR: z.string().min(1).optional(),
});

export type ModelClientConfig =
  | { provider: "mock" }
  | {
      provider: "ollama";
      apiKey: string;
      baseUrl: string | undefined;
      model: string | undefined;
    }
  | {
      provider: "openai-compatible";
      apiKey: string;
      baseUrl: string | undefined;
      model: string | undefined;
    };

export function loadEnvironmentFile(): void {
  try {
    process.loadEnvFile();
  } catch {
    // The runtime can be configured entirely through its environment.
  }
}

export function resolveModelClientConfig(
  environment: NodeJS.ProcessEnv
): ModelClientConfig {
  const parsed = RuntimeEnvironmentSchema.parse(environment);
  const provider = resolveProvider(parsed);

  if (provider === "mock") {
    return { provider };
  }

  if (provider === "ollama") {
    if (!parsed.OLLAMA_API_KEY) {
      throw new Error("OLLAMA_API_KEY is required when AUTO_ESSAY_LLM_PROVIDER=ollama");
    }
    return {
      provider,
      apiKey: parsed.OLLAMA_API_KEY,
      baseUrl: parsed.OLLAMA_BASE_URL,
      model: parsed.OLLAMA_MODEL,
    };
  }

  if (!parsed.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is required when AUTO_ESSAY_LLM_PROVIDER=openai-compatible"
    );
  }

  return {
    provider,
    apiKey: parsed.OPENAI_API_KEY,
    baseUrl: resolveOpenAiBaseUrl(parsed),
    model: parsed.OPENAI_MODEL,
  };
}

function resolveProvider(
  environment: z.infer<typeof RuntimeEnvironmentSchema>
): z.infer<typeof ProviderSchema> {
  if (environment.AUTO_ESSAY_LLM_PROVIDER) {
    return environment.AUTO_ESSAY_LLM_PROVIDER;
  }

  if (environment.OLLAMA_API_KEY && environment.OPENAI_API_KEY) {
    throw new Error(
      "AUTO_ESSAY_LLM_PROVIDER is required when both OLLAMA_API_KEY and OPENAI_API_KEY are set"
    );
  }

  if (environment.OLLAMA_API_KEY) {
    return "ollama";
  }

  if (environment.OPENAI_API_KEY) {
    return "openai-compatible";
  }

  return "mock";
}

function resolveOpenAiBaseUrl(
  environment: z.infer<typeof RuntimeEnvironmentSchema>
): string | undefined {
  if (
    environment.OPENAI_BASE_URL &&
    environment.OPENAI_API_BASE &&
    environment.OPENAI_BASE_URL !== environment.OPENAI_API_BASE
  ) {
    throw new Error(
      "OPENAI_BASE_URL and legacy OPENAI_API_BASE must match when both are configured"
    );
  }

  return environment.OPENAI_BASE_URL ?? environment.OPENAI_API_BASE;
}
