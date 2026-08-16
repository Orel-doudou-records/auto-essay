import type { EditorialDecision } from "../domain/editorialDecision";
import type { EditorialProjectionBundle } from "../domain/editorialProjection";
import {
  EditorialManifestProvenanceSchema,
  type EditorialManifestProvenance,
} from "../domain/revision";
import { sameStringSet, unique } from "../utils/array";

export interface CreateEditorialManifestProvenanceInput {
  planId: string;
  decisions: EditorialDecision[];
  articulationIds: string[];
  projections: EditorialProjectionBundle;
  transformationTraceIds?: string[];
  editorialEffectEvaluationId?: string;
  revisionBriefId?: string;
}

export function createEditorialManifestProvenance(
  input: CreateEditorialManifestProvenanceInput
): EditorialManifestProvenance {
  const projectionPlanIds = new Set([
    input.projections.writer.planId,
    input.projections.evaluator.planId,
    input.projections.revision.planId,
  ]);

  if (projectionPlanIds.size !== 1 || !projectionPlanIds.has(input.planId)) {
    throw new Error("Editorial projections do not share the requested plan");
  }

  const projectionUnitKeys = new Set([
    `${input.projections.writer.unitId}@${input.projections.writer.unitVersion}`,
    `${input.projections.evaluator.unitId}@${input.projections.evaluator.unitVersion}`,
    `${input.projections.revision.unitId}@${input.projections.revision.unitVersion}`,
  ]);

  if (projectionUnitKeys.size !== 1) {
    throw new Error("Editorial projections do not target the same unit version");
  }

  const inactiveDecision = input.decisions.find(
    (decision) => decision.status !== "active"
  );
  if (inactiveDecision) {
    throw new Error(
      `Cannot persist inactive editorial decision ${inactiveDecision.id}`
    );
  }

  const decisionIds = input.decisions.map((decision) => decision.id);
  if (!sameStringSet(decisionIds, input.projections.writer.decisionIds)) {
    throw new Error("Editorial decisions do not match projection decisions");
  }

  if (
    !sameStringSet(
      input.articulationIds,
      input.projections.writer.articulationIds
    )
  ) {
    throw new Error("Editorial articulations do not match projection articulations");
  }

  return EditorialManifestProvenanceSchema.parse({
    planId: input.planId,
    decisions: input.decisions.map((decision) => ({
      decisionId: decision.id,
      version: decision.version,
    })),
    articulationIds: unique(input.articulationIds),
    projectionIds: {
      writer: input.projections.writer.id,
      evaluator: input.projections.evaluator.id,
      revision: input.projections.revision.id,
    },
    projectionHashes: {
      writer: computeDeterministicHash(input.projections.writer),
      evaluator: computeDeterministicHash(input.projections.evaluator),
      revision: computeDeterministicHash(input.projections.revision),
    },
    transformationTraceIds: unique(input.transformationTraceIds ?? []),
    editorialEffectEvaluationId: input.editorialEffectEvaluationId,
    revisionBriefId: input.revisionBriefId,
  });
}

/**
 * Empreinte stable pour des projections JSON : l'ordre des clés d'objet ne
 * modifie pas le résultat, contrairement à JSON.stringify brut.
 */
export function computeDeterministicHash(value: unknown): string {
  const serialized = stableStringify(value);
  let hash = 2166136261;

  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);

  return `{${entries.join(",")}}`;
}
