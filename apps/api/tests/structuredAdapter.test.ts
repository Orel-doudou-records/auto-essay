import { describe, it, expect } from "vitest";
import type { ModelClient } from "../src/llm/client.js";
import { StructuredClientAdapter } from "../src/llm/structuredAdapter.js";

function makeClient(responses: string[]): ModelClient {
  let i = 0;
  return {
    async complete(): Promise<string> {
      const r = responses[Math.min(i, responses.length - 1)];
      i++;
      return r;
    },
    async completeStream(): Promise<void> {},
  };
}

describe("StructuredClientAdapter.generateJson", () => {
  it("parse une réponse JSON valide", async () => {
    const adapter = new StructuredClientAdapter(makeClient(['{"a": 1}']));
    await expect(adapter.generateJson("p")).resolves.toEqual({ a: 1 });
  });

  it("réessaie une fois sur réponse invalide puis valide", async () => {
    const responses = ["pas du json", '{"a": 2}'];
    const adapter = new StructuredClientAdapter(makeClient(responses));
    await expect(adapter.generateJson("p")).resolves.toEqual({ a: 2 });
  });

  it("répare sans retry une réponse entourée de balises", async () => {
    const adapter = new StructuredClientAdapter(
      makeClient(['```json\n{"a": 3}\n```'])
    );
    await expect(adapter.generateJson("p")).resolves.toEqual({ a: 3 });
  });

  it("lève une erreur si toutes les tentatives échouent", async () => {
    const adapter = new StructuredClientAdapter(
      makeClient(["pas du json", "toujours pas"])
    );
    await expect(adapter.generateJson("p")).rejects.toThrow(/non-JSON/);
  });
});
