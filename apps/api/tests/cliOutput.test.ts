import { describe, expect, it, vi } from "vitest";
import { createCliOutput } from "../src/observability/cliOutput.js";

describe("sortie CLI", () => {
  it("sépare le bilan normal et le diagnostic d’erreur", () => {
    const writeStdout = vi.fn();
    const writeStderr = vi.fn();
    const output = createCliOutput({ writeStdout, writeStderr });

    output.success("Bibliothèque écrite.");
    output.error("Import incomplet.");

    expect(writeStdout).toHaveBeenCalledWith("Bibliothèque écrite.\n");
    expect(writeStderr).toHaveBeenCalledWith("Import incomplet.\n");
  });
});
