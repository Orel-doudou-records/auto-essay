import { afterEach, vi } from "vitest";

process.env.AUTO_ESSAY_LLM_PROVIDER = "mock";
delete process.env.OLLAMA_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.OPENAI_BASE_URL;
delete process.env.OPENAI_API_BASE;

const unexpectedFetch = async (): Promise<Response> => {
  throw new Error("Unexpected network request in API tests. Stub fetch explicitly.");
};

vi.stubGlobal("fetch", unexpectedFetch);

afterEach(() => {
  vi.stubGlobal("fetch", unexpectedFetch);
});
