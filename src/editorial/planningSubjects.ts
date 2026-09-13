import { z } from "zod";
import type { StructuredModelClient } from "../evaluation/evaluateEssay.js";
import {
  createPlanningBrief,
  type PlanningBrief,
  type PlanningScopeRefInput,
} from "../domain/planningBrief.js";
import type { Manuscript } from "../domain/manuscript.js";
import type { IngestedDocument } from "../domain/ingestedDocument.js";
import type { SourceProfile } from "../domain/sourceProfile.js";
import type { RetrievedPassage } from "../bibliography/corpusExplorer.js";
import {
  materializeCorpusSynthesis,
  synthesizeClosedCorpus,
  type CorpusSynthesis,
  type CorpusSynthesisObservationKind,
} from "../bibliography/corpusSynthesis.js";

/**
 * Transient adapter shape for Plan V2. It is deliberately NOT a canonical
 * corpus contract: callers map retrieval results into this snapshot.
 */
export const PlanningPassageSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  text: z.string().min(1),
  locator: z.string().min(1).optional(),
});
export type PlanningPassage = z.infer<typeof PlanningPassageSchema>;

export const CorpusExplorationSnapshotSchema = z.object({
  registeredSourceCount: z.number().int().nonnegative(),
  exploredSourceIds: z.array(z.string().min(1)),
  explorationComplete: z.boolean(),
  passages: z.array(PlanningPassageSchema),
});
export type CorpusExplorationSnapshot = z.infer<
  typeof CorpusExplorationSnapshotSchema
>;

const EvidenceRoleSchema = z.enum(["supports", "contests", "context"]);
const RawEvidenceRefSchema = z.object({
  passageId: z.string().min(1),
  role: EvidenceRoleSchema,
});

const RawPlanningAxisSchema = z.object({
  label: z.string().min(1),
  question: z.string().min(1),
  rationale: z.string().min(1),
  evidence: z.array(RawEvidenceRefSchema),
  limits: z.array(z.string().min(1)).default([]),
});

const RawSubjectProposalSchema = z.object({
  title: z.string().min(1),
  question: z.string().min(1),
  angle: z.string().min(1),
  hypotheses: z.array(z.string().min(1)).min(1),
  distinctiveness: z.string().min(1),
  evidence: z.array(RawEvidenceRefSchema),
  limits: z.array(z.string().min(1)).default([]),
});

const RawPlanningExplorationSchema = z.object({
  axes: z.array(RawPlanningAxisSchema).min(1),
  subjects: z.array(RawSubjectProposalSchema).min(2),
});

export const DocumentaryFoundationStatusSchema = z.enum([
  "emergent",
  "supported",
  "contested",
  "under_documented",
]);
export type DocumentaryFoundationStatus = z.infer<
  typeof DocumentaryFoundationStatusSchema
>;

export interface PlanningEvidenceRef {
  passageId: string;
  sourceId: string;
  role: z.infer<typeof EvidenceRoleSchema>;
}

export interface PlanningAxis {
  label: string;
  question: string;
  rationale: string;
  evidence: PlanningEvidenceRef[];
  limits: string[];
  status: DocumentaryFoundationStatus;
}

export interface PlanningSubjectProposal {
  title: string;
  question: string;
  angle: string;
  hypotheses: string[];
  distinctiveness: string;
  evidence: PlanningEvidenceRef[];
  limits: string[];
  status: DocumentaryFoundationStatus;
}

export interface PlanningSubjectExploration {
  axes: PlanningAxis[];
  subjects: PlanningSubjectProposal[];
  coverage: {
    registeredSourceCount: number;
    exploredSourceCount: number;
    explorationComplete: boolean;
  };
}

export interface PlanningCorpusSignal {
  id: string;
  kind: CorpusSynthesisObservationKind;
  statement: string;
  passageIds: string[];
}

export function buildPlanningSubjectPrompt(
  snapshot: CorpusExplorationSnapshot,
  cadrage?: string,
  signals: PlanningCorpusSignal[] = []
): string {
  const passages = snapshot.passages
    .map(
      (passage) =>
        `[${passage.id}] source=${passage.sourceId}${passage.locator ? ` locator=${passage.locator}` : ""}\n${passage.text}`
    )
    .join("\n\n");
  const comparativeSignals = signals
    .map(
      (signal) =>
        `[${signal.id}] kind=${signal.kind} passages=${signal.passageIds.join(",")}\n${signal.statement}`
    )
    .join("\n\n");

  return `Tu aides un auteur à découvrir ce qu'un corpus peut réellement permettre de penser avant de figer une thèse.

Règles impératives :
- Tu n'utilises QUE les passages fournis ci-dessous et, s'ils existent, les signaux comparatifs dérivés de ces passages.
- Les signaux comparatifs ne sont pas des preuves : toute fondation documentaire doit citer des passageId réels.
- Une absence dans ces passages n'est jamais une preuve d'absence dans le corpus.
- Ne complète jamais une lacune avec ta connaissance générale.
- Propose d'abord des axes fertiles, puis plusieurs sujets de livre réellement distincts.
- Les hypothèses restent des hypothèses : ne les transforme pas en faits.
- Chaque axe et chaque sujet doit citer les passageId qui le fondent, avec un rôle supports|contests|context.
- Si la matière est insuffisante, rends cette limite explicite dans limits.

Couverture observée : ${snapshot.exploredSourceIds.length}/${snapshot.registeredSourceCount} sources explorées. Exploration complète : ${snapshot.explorationComplete ? "oui" : "non"}.
${cadrage ? `\nCadrage auteur :\n${cadrage}\n` : ""}
${comparativeSignals ? `Signaux comparatifs ancrés :\n${comparativeSignals}\n\n` : ""}Passages disponibles :
${passages || "Aucun passage récupéré."}

JSON strict attendu :
{
  "axes": [
    {
      "label": "string",
      "question": "string",
      "rationale": "string",
      "evidence": [{"passageId":"string","role":"supports|contests|context"}],
      "limits": ["string"]
    }
  ],
  "subjects": [
    {
      "title": "string",
      "question": "string",
      "angle": "string",
      "hypotheses": ["string"],
      "distinctiveness": "string",
      "evidence": [{"passageId":"string","role":"supports|contests|context"}],
      "limits": ["string"]
    }
  ]
}`;
}

export async function proposePlanningSubjects(
  snapshotInput: CorpusExplorationSnapshot,
  client: StructuredModelClient,
  cadrage?: string,
  signals: PlanningCorpusSignal[] = []
): Promise<PlanningSubjectExploration> {
  const snapshot = CorpusExplorationSnapshotSchema.parse(snapshotInput);
  const raw = await client.generateJson(
    buildPlanningSubjectPrompt(snapshot, cadrage, signals)
  );
  const parsed = RawPlanningExplorationSchema.parse(raw);
  const byPassageId = new Map(snapshot.passages.map((passage) => [passage.id, passage]));

  const mapEvidence = (refs: z.infer<typeof RawEvidenceRefSchema>[]): PlanningEvidenceRef[] =>
    refs.map((ref) => {
      const passage = byPassageId.get(ref.passageId);
      if (!passage) {
        throw new Error(`Planning proposal references unknown passage '${ref.passageId}'`);
      }
      return { passageId: ref.passageId, sourceId: passage.sourceId, role: ref.role };
    });

  const decorate = <T extends { evidence: z.infer<typeof RawEvidenceRefSchema>[]; limits: string[] }>(
    item: T
  ): Omit<T, "evidence"> & {
    evidence: PlanningEvidenceRef[];
    status: DocumentaryFoundationStatus;
  } => {
    const evidence = mapEvidence(item.evidence);
    return {
      ...item,
      evidence,
      status: deriveDocumentaryStatus(evidence, snapshot.explorationComplete),
    };
  };

  return {
    axes: parsed.axes.map(decorate),
    subjects: parsed.subjects.map(decorate),
    coverage: {
      registeredSourceCount: snapshot.registeredSourceCount,
      exploredSourceCount: snapshot.exploredSourceIds.length,
      explorationComplete: snapshot.explorationComplete,
    },
  };
}

export function createPlanningCorpusSnapshot(input: {
  registeredSourceCount: number;
  exploredSourceIds: string[];
  explorationComplete: boolean;
  passages: RetrievedPassage[];
}): CorpusExplorationSnapshot {
  return CorpusExplorationSnapshotSchema.parse({
    registeredSourceCount: input.registeredSourceCount,
    exploredSourceIds: [...new Set(input.exploredSourceIds)],
    explorationComplete: input.explorationComplete,
    passages: input.passages.map((passage) => ({
      id: passage.id,
      sourceId: passage.sourceId,
      text: passage.text,
      locator: `${passage.locator.kind}:${passage.locator.value}`,
    })),
  });
}

export async function proposePlanningSubjectsFromClosedCorpus(
  input: {
    documents: IngestedDocument[];
    profiles: SourceProfile[];
    excludedSourceIds?: string[];
  },
  client: StructuredModelClient,
  cadrage?: string
): Promise<{
  synthesis: CorpusSynthesis;
  passages: RetrievedPassage[];
  retrievalCoverage: {
    anchorCount: number;
    materializedAnchorCount: number;
    complete: boolean;
  };
  planning: PlanningSubjectExploration;
}> {
  const synthesis = await synthesizeClosedCorpus({
    documents: input.documents,
    profiles: input.profiles,
    excludedSourceIds: input.excludedSourceIds,
    client,
  });
  const materialized = await materializeCorpusSynthesis({
    synthesis,
    documents: input.documents,
  });
  if (!materialized.coverage.complete) {
    throw new Error("Corpus synthesis anchors were not fully materialized");
  }

  const passageIdByAnchor = new Map(
    materialized.passages.map((passage) => [
      `${passage.sourceId}:${passage.span.blockId}`,
      passage.id,
    ] as const)
  );
  const signals: PlanningCorpusSignal[] = synthesis.observations.map((observation) => ({
    id: observation.id,
    kind: observation.kind,
    statement: observation.statement,
    passageIds: observation.anchors.map((anchor) => {
      const passageId = passageIdByAnchor.get(`${anchor.sourceId}:${anchor.blockId}`);
      if (!passageId) {
        throw new Error(
          `No RetrievedPassage materialized for synthesis anchor '${anchor.sourceId}:${anchor.blockId}'`
        );
      }
      return passageId;
    }),
  }));

  const snapshot = createPlanningCorpusSnapshot({
    registeredSourceCount: synthesis.sourceIds.length,
    exploredSourceIds: synthesis.sourceIds,
    explorationComplete: materialized.coverage.complete,
    passages: materialized.passages,
  });
  const planning = await proposePlanningSubjects(snapshot, client, cadrage, signals);

  return {
    synthesis,
    passages: materialized.passages,
    retrievalCoverage: materialized.coverage,
    planning,
  };
}

export function deriveDocumentaryStatus(
  evidence: PlanningEvidenceRef[],
  explorationComplete: boolean
): DocumentaryFoundationStatus {
  const supports = evidence.some((item) => item.role === "supports");
  const contests = evidence.some((item) => item.role === "contests");

  if (!supports && !contests) return "under_documented";
  if (contests) return "contested";
  if (supports && explorationComplete) return "supported";
  return "emergent";
}

export function createPlanningBriefFromSubject(input: {
  manuscript: Manuscript;
  scopeRef: PlanningScopeRefInput;
  subject: PlanningSubjectProposal;
}): PlanningBrief {
  const sourceRefs = [...new Set(input.subject.evidence.map((item) => item.sourceId))];
  return createPlanningBrief({
    manuscript: input.manuscript,
    scopeRef: input.scopeRef,
    question: input.subject.question,
    angleOrFunction: input.subject.angle,
    hypotheses: input.subject.hypotheses.map((statement) => ({
      statement,
      status:
        input.subject.status === "supported"
          ? "supported"
          : input.subject.status === "contested"
            ? "contested"
            : input.subject.status === "under_documented"
              ? "under_documented"
              : "emergent",
      sourceRefs,
    })),
    sourceRefs,
    rationale: input.subject.distinctiveness,
  });
}
