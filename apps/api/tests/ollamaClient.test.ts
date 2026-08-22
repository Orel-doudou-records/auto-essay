import { afterEach, describe, expect, it, vi } from "vitest";
import { OllamaClient } from "../src/llm/ollamaClient";

describe("OllamaClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls /api/chat with bearer auth and parses message.content", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: { content: "bonjour" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new OllamaClient("test-key");
    const result = await client.complete("systeme", "utilisateur");

    expect(result).toBe("bonjour");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://ollama.com/api/chat");
    expect(init.headers).toMatchObject({ Authorization: "Bearer test-key" });

    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("mistral-large-3:675b");
    expect(body.stream).toBe(false);
    expect(body.messages).toHaveLength(2);
  });

  it("throws on non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("unauthorized", { status: 401 }))
    );

    const client = new OllamaClient("bad-key");
    await expect(client.complete("s", "u")).rejects.toThrow(/401/);
  });
});
