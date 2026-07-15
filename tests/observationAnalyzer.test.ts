import { describe, expect, it } from "vitest";
import {
  ObservationAnalyzer,
  type ObservationAnalysisRequest,
} from "../src/editorial/observationAnalyzer";

class MockStructuredClient {
  calls = 0;

  constructor(private readonly output: unknown) {}

  async generateJson(): Promise<unknown> {
    this.calls += 1;
    return this.output;
  }
}

const sourceText =
  "L'archive affirme que le lieu a disparu. Pourtant, le témoignage continue de le nommer au présent.";

const request: ObservationAnalysisRequest = {
  authorId: "author-1",
  sourceTextId: "text-1",
  sourceText,
  sourceLabel: "Passage test",
};

function validOutput(excerpt = "Pourtant") {
  return {
    observations: [
      {
        contentConfiguration: {
          argumentativeFunction: "introduire une contradiction documentaire",
          sourceRegimes: ["institutional_archive", "testimony"],
          relations: ["deux versions incompatibles du même lieu"],
        },
        formalOperations: [
          {
            family: "enunciation_structure",
            category: "contradiction_structure",
            trigger: "le passage du constat archivistique au témoignage",
            operation: "rupture explicite par un connecteur adversatif",
            target: "transition",
            observedEffect: "empêche la fusion des deux versions",
            intensity: "structuring",
          },
        ],
        observedEffects: {
          epistemic: ["maintient visibles deux régimes documentaires"],
        },
        evidence: { excerpt },
        confidence: "high",
        maturity: "single_observation",
        notes: ["observation locale, non signature"],
      },
    ],
  };
}

describe("ObservationAnalyzer", () => {
  it("creates grounded observations with system-owned identity and provenance", async () => {
    const client = new MockStructuredClient(validOutput());
    const analyzer = new ObservationAnalyzer(client);

    const observations = await analyzer.analyze(request);

    expect(observations).toHaveLength(1);
    expect(observations[0].id).toBeDefined();
    expect(observations[0].authorId).toBe("author-1");
    expect(observations[0].sourceTextId).toBe("text-1");
    expect(observations[0].provenance.origin).toBe("author_text_analysis");
    expect(observations[0].provenance.notes).toEqual([
      "observation locale, non signature",
    ]);
    expect(observations[0].maturity).toBe("single_observation");
  });

  it("allows the model to return zero observations", async () => {
    const client = new MockStructuredClient({ observations: [] });
    const analyzer = new ObservationAnalyzer(client);

    await expect(analyzer.analyze(request)).resolves.toEqual([]);
  });

  it("does not call the model for an empty passage", async () => {
    const client = new MockStructuredClient(validOutput());
    const analyzer = new ObservationAnalyzer(client);

    const observations = await analyzer.analyze({
      ...request,
      sourceText: "   ",
    });

    expect(observations).toEqual([]);
    expect(client.calls).toBe(0);
  });

  it("rejects an excerpt fabricated by the model", async () => {
    const client = new MockStructuredClient(
      validOutput("Cet extrait n'existe pas")
    );
    const analyzer = new ObservationAnalyzer(client);

    await expect(analyzer.analyze(request)).rejects.toThrow(
      "absent from the source text"
    );
  });

  it("rejects offsets that point outside the source text", async () => {
    const output = validOutput();
    output.observations[0].evidence = {
      location: { start: 0, end: sourceText.length + 10 },
    } as { excerpt: string };

    const client = new MockStructuredClient(output);
    const analyzer = new ObservationAnalyzer(client);

    await expect(analyzer.analyze(request)).rejects.toThrow(
      "outside the source text"
    );
  });
});
