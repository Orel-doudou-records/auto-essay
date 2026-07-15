import { describe, expect, it } from "vitest";
import {
  ContentRelationSchema,
  ContentStyleArticulationSchema,
  EditorialDecisionSchema,
  EditorialPlanSchema,
  SourceRegimeSchema,
  StyleObservationSchema,
} from "../src/domain";

describe("domain public exports", () => {
  it("should expose the relational Literacraft contracts", () => {
    expect(SourceRegimeSchema).toBeDefined();
    expect(StyleObservationSchema).toBeDefined();
    expect(ContentRelationSchema).toBeDefined();
    expect(ContentStyleArticulationSchema).toBeDefined();
    expect(EditorialDecisionSchema).toBeDefined();
    expect(EditorialPlanSchema).toBeDefined();
  });
});
