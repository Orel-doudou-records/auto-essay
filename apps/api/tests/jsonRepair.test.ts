import { describe, it, expect } from "vitest";
import { parseJsonRobustly } from "../src/llm/jsonRepair.js";

describe("parseJsonRobustly", () => {
  it("parse un JSON valide", () => {
    expect(parseJsonRobustly('{"a":1}')).toEqual({ a: 1 });
  });

  it("retire les balises markdown ```json", () => {
    expect(parseJsonRobustly('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("retire les balises ``` sans langage", () => {
    expect(parseJsonRobustly('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("extrait le JSON au milieu de texte parasite", () => {
    const raw = 'Voici le résultat :\n{"a": 1, "b": [2, 3]}\nMerci.';
    expect(parseJsonRobustly(raw)).toEqual({ a: 1, b: [2, 3] });
  });

  it("corrige les virgules de fin", () => {
    expect(parseJsonRobustly('{"a": 1, "b": [2, 3,]}')).toEqual({ a: 1, b: [2, 3] });
  });

  it("répare un JSON tronqué (structure non refermée)", () => {
    expect(parseJsonRobustly('{"a": 1, "b": [2, 3')).toEqual({ a: 1, b: [2, 3] });
  });

  it("parse un tableau racine", () => {
    expect(parseJsonRobustly("[1, 2, 3]")).toEqual([1, 2, 3]);
  });

  it("lève une erreur sur du non-JSON", () => {
    expect(() => parseJsonRobustly("pas de JSON ici")).toThrow();
  });
});
