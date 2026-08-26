import { afterEach, describe, expect, it, vi } from "vitest";
import { ModelClientError } from "../src/llm/errors.js";
import { OpenAiClient } from "../src/llm/openAiClient.js";

describe("OpenAiClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("validates the completion shape and sends a timeout signal", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: "bonjour" } }] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new OpenAiClient("test-key");
    await expect(client.complete("system", "user")).resolves.toBe("bonjour");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("returns a typed invalid-response error without leaking the API key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [] }), { status: 200 }))
    );

    const client = new OpenAiClient("secret-api-key");
    await expect(client.complete("system", "user")).rejects.toMatchObject({
      name: "ModelClientError",
      kind: "response_invalid",
      retryable: false,
    } satisfies Partial<ModelClientError>);
    await expect(client.complete("system", "user")).rejects.not.toThrow("secret-api-key");
  });

  it("retries a rate limit once before returning a valid completion", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("slow down", { status: 429 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ choices: [{ message: { content: "réussi" } }] }),
          { status: 200 }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const client = new OpenAiClient("test-key", undefined, undefined, {
      maxAttempts: 2,
      retryDelayMs: 0,
    });
    await expect(client.complete("system", "user")).resolves.toBe("réussi");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry an authentication failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("invalid key", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new OpenAiClient("test-key", undefined, undefined, {
      maxAttempts: 2,
      retryDelayMs: 0,
    });
    await expect(client.complete("system", "user")).rejects.toMatchObject({
      kind: "authentication",
      retryable: false,
    } satisfies Partial<ModelClientError>);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("normalizes timeout and malformed streaming errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("deadline", "TimeoutError"))
    );
    const timeoutClient = new OpenAiClient("test-key", undefined, undefined, {
      maxAttempts: 1,
    });
    await expect(timeoutClient.complete("system", "user")).rejects.toMatchObject({
      kind: "timeout",
      retryable: true,
    } satisfies Partial<ModelClientError>);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("data: {not-json}\n\n", { status: 200 }))
    );
    const streamClient = new OpenAiClient("test-key");
    await expect(streamClient.completeStream("system", "user", () => undefined)).rejects.toMatchObject({
      kind: "response_invalid",
      retryable: false,
    } satisfies Partial<ModelClientError>);
  });
});
