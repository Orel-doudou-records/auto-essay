import { describe, expect, it } from "vitest";

describe("API test network guard", () => {
  it("rejects an unstubbed outbound request", async () => {
    await expect(fetch("https://provider.example.test/chat/completions")).rejects.toThrow(
      "Unexpected network request"
    );
  });
});
