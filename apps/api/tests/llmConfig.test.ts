import { describe, expect, it } from "vitest";
import { resolveModelClientConfig } from "../src/env.js";

describe("resolveModelClientConfig", () => {
  it("uses the mock client when no provider or credential is configured", () => {
    expect(resolveModelClientConfig({})).toEqual({ provider: "mock" });
  });

  it("rejects an ambiguous implicit provider selection", () => {
    expect(() =>
      resolveModelClientConfig({
        OPENAI_API_KEY: "openai-key",
        OLLAMA_API_KEY: "ollama-key",
      })
    ).toThrow("AUTO_ESSAY_LLM_PROVIDER");
  });

  it("rejects an explicit provider without its required credential", () => {
    expect(() =>
      resolveModelClientConfig({ AUTO_ESSAY_LLM_PROVIDER: "openai-compatible" })
    ).toThrow("OPENAI_API_KEY");
  });

  it("prefers OPENAI_BASE_URL and rejects a conflicting legacy alias", () => {
    expect(resolveModelClientConfig({
      AUTO_ESSAY_LLM_PROVIDER: "openai-compatible",
      OPENAI_API_KEY: "openai-key",
      OPENAI_BASE_URL: "https://primary.example/v1",
    })).toEqual({
      provider: "openai-compatible",
      apiKey: "openai-key",
      baseUrl: "https://primary.example/v1",
      model: undefined,
    });

    expect(() =>
      resolveModelClientConfig({
        AUTO_ESSAY_LLM_PROVIDER: "openai-compatible",
        OPENAI_API_KEY: "openai-key",
        OPENAI_BASE_URL: "https://primary.example/v1",
        OPENAI_API_BASE: "https://legacy.example/v1",
      })
    ).toThrow("OPENAI_BASE_URL");
  });
});
