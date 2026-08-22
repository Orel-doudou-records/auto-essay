export interface ModelClient {
  complete(system: string, user: string): Promise<string>;
  completeStream(
    system: string,
    user: string,
    onChunk: (chunk: string) => void
  ): Promise<void>;
}

export async function createModelClient(): Promise<ModelClient> {
  const ollamaKey = process.env.OLLAMA_API_KEY;
  if (ollamaKey) {
    const { OllamaClient } = await import("./ollamaClient.js");
    return new OllamaClient(ollamaKey, process.env.OLLAMA_BASE_URL, process.env.OLLAMA_MODEL);
  }
  const key = process.env.OPENAI_API_KEY;
  if (key) {
    const { OpenAiClient } = await import("./openAiClient.js");
    return new OpenAiClient(key, process.env.OPENAI_BASE_URL, process.env.OPENAI_MODEL);
  }
  const { MockClient } = await import("./mockClient.js");
  return new MockClient();
}
