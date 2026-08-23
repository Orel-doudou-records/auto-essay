import { describe, expect, it } from "vitest";
import {
  ConceptSchema,
  ContentRelationSchema,
  ContentStyleArticulationSchema,
  DiffractiveReadingSchema,
  EditorialDecisionSchema,
  EditorialPlanSchema,
  SourceRegimeSchema,
  StyleObservationSchema,
  TensionSchema,
} from "../src/domain";

describe("domain public exports", () => {
  it("should expose the relational Literacraft contracts", () => {
    expect(SourceRegimeSchema).toBeDefined();
    expect(StyleObservationSchema).toBeDefined();
    expect(ContentRelationSchema).toBeDefined();
    expect(ContentStyleArticulationSchema).toBeDefined();
    expect(DiffractiveReadingSchema).toBeDefined();
    expect(EditorialDecisionSchema).toBeDefined();
    expect(EditorialPlanSchema).toBeDefined();
  });

  it("should expose persisted conceptual nodes", () => {
    expect(ConceptSchema).toBeDefined();
    expect(TensionSchema).toBeDefined();
  });
});
