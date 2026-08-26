import {
  resolveModelClientConfig,
  type ModelClientConfig,
} from "../env.js";

export interface ModelClient {
  complete(system: string, user: string): Promise<string>;
  completeStream(
    system: string,
    user: string,
    onChunk: (chunk: string) => void
  ): Promise<void>;
}

export type ModelClientFactory = () => Promise<ModelClient>;

export function createModelClientFactory(config: ModelClientConfig): ModelClientFactory {
  return async () => {
    switch (config.provider) {
      case "ollama": {
        const { OllamaClient } = await import("./ollamaClient.js");
        return new OllamaClient(config.apiKey, config.baseUrl, config.model);
      }
      case "openai-compatible": {
        const { OpenAiClient } = await import("./openAiClient.js");
        return new OpenAiClient(config.apiKey, config.baseUrl, config.model);
      }
      case "mock": {
        const { MockClient } = await import("./mockClient.js");
        return new MockClient();
      }
    }
  };
}

export const createModelClient: ModelClientFactory = async (): Promise<ModelClient> => {
  const factory = createModelClientFactory(resolveModelClientConfig(process.env));
  return factory();
};
