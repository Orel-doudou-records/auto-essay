import { z } from "zod";
import {
  IngestedDocumentSchema,
  IngestedSpanRefSchema,
  readIngestedSpan,
  type IngestedDocument,
} from "../domain/ingestedDocument.js";
import { CitationLocatorSchema } from "../domain/citation.js";

export const RetrievalModeSchema = z.enum(["exploration", "corroboration"]);
export type RetrievalMode = z.infer<typeof RetrievalModeSchema>;

export const CorroborationProbeSchema = z.enum([
  "support",
  "contradiction",
  "qualification",
  "counterexample",
  "alternative",
]);
export type CorroborationProbe = z.infer<typeof CorroborationProbeSchema>;

export const CorpusRetrievalQuerySchema = z
  .object({
    query: z.string().trim().min(1),
    mode: RetrievalModeSchema,
    probe: CorroborationProbeSchema.optional(),
    limit: z.number().int().positive().max(100).default(10),
  })
  .superRefine((value, context) => {
    if (value.mode === "corroboration" && !value.probe) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["probe"],
        message: "Corroboration retrieval requires an explicit probe",
      });
    }
    if (value.mode === "exploration" && value.probe) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["probe"],
        message: "Exploration retrieval does not accept a corroboration probe",
      });
    }
  });

export type CorpusRetrievalQuery = z.infer<typeof CorpusRetrievalQuerySchema>;
export type CorpusRetrievalQueryInput = z.input<typeof CorpusRetrievalQuerySchema>;

export const RetrievedPassageSchema = z
  .object({
    id: z.string().min(1),
    sourceId: z.string().min(1),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    span: IngestedSpanRefSchema,
    locator: CitationLocatorSchema,
    text: z.string().min(1),
    mode: RetrievalModeSchema,
    probe: CorroborationProbeSchema.optional(),
    reason: z.string().min(1).optional(),
  })
  .superRefine((value, context) => {
    if (value.mode === "corroboration" && !value.probe) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["probe"],
        message: "A corroboration passage must retain its probe",
      });
    }
    if (value.mode === "exploration" && value.probe) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["probe"],
        message: "An exploration passage cannot carry a corroboration probe",
      });
    }
  });

export type RetrievedPassage = z.infer<typeof RetrievedPassageSchema>;

export interface CorpusExplorer {
  retrieve(input: CorpusRetrievalQueryInput): Promise<RetrievedPassage[]>;
}

/**
 * Backend seam only. It may suggest locations, never passage text or evidence.
 * Final text is always rematerialized from the canonical IngestedDocument.
 */
export type CorpusLocator = (
  input: CorpusRetrievalQuery
) => Promise<
  Array<{
    documentId: string;
    blockId: string;
    start?: number;
    end?: number;
    reason?: string;
  }>
>;

export function createCorpusExplorer(
  documentInputs: IngestedDocument[],
  locator?: CorpusLocator
): CorpusExplorer {
  const documents = documentInputs.map((document) => IngestedDocumentSchema.parse(document));
  const byDocumentId = new Map(documents.map((document) => [document.id, document] as const));
  if (byDocumentId.size !== documents.length) {
    throw new Error("CorpusExplorer requires unique IngestedDocument ids");
  }

  const locate = locator ?? createLocalLexicalLocator(documents);

  return {
    async retrieve(input: CorpusRetrievalQueryInput): Promise<RetrievedPassage[]> {
      const query = CorpusRetrievalQuerySchema.parse(input);
      const locations = await locate(query);
      const passages: RetrievedPassage[] = [];
      const seen = new Set<string>();

      for (const location of locations) {
        if (passages.length >= query.limit) break;

        const document = byDocumentId.get(location.documentId);
        if (!document) {
          throw new Error(`Locator returned unknown document '${location.documentId}'`);
        }
        const block = document.blocks.find((candidate) => candidate.id === location.blockId);
        if (!block) {
          throw new Error(
            `Locator returned unknown block '${location.blockId}' for document '${document.id}'`
          );
        }

        const span = IngestedSpanRefSchema.parse({
          documentId: document.id,
          blockId: block.id,
          start: location.start ?? 0,
          end: location.end ?? block.text.length,
        });
        const text = readIngestedSpan(document, span);
        if (text.length === 0) continue;

        const id = `${document.id}:${block.id}:${span.start}-${span.end}`;
        if (seen.has(id)) continue;
        seen.add(id);

        passages.push(
          RetrievedPassageSchema.parse({
            id,
            sourceId: document.sourceId,
            fingerprint: document.fingerprint,
            span,
            locator: block.locator,
            text,
            mode: query.mode,
            probe: query.probe,
            reason: location.reason,
          })
        );
      }

      return passages;
    },
  };
}

function createLocalLexicalLocator(documents: IngestedDocument[]): CorpusLocator {
  return async (input) => {
    const tokens = tokenize(input.query);
    if (tokens.length === 0) return [];

    const scored = documents.flatMap((document) =>
      document.blocks.flatMap((block) => {
        const searchable = normalize(`${block.sectionPath.join(" ")} ${block.text}`);
        const matched = tokens.filter((token) => searchable.includes(token));
        if (matched.length === 0) return [];
        return [
          {
            documentId: document.id,
            sourceId: document.sourceId,
            blockId: block.id,
            blockOrder: block.order,
            score: matched.length,
            reason: `lexical:${matched.join(",")}`,
          },
        ];
      })
    );

    scored.sort(
      (left, right) =>
        right.score - left.score ||
        left.documentId.localeCompare(right.documentId) ||
        left.blockOrder - right.blockOrder
    );

    const selected =
      input.mode === "exploration"
        ? diversifyBySource(scored, input.limit)
        : scored.slice(0, input.limit);

    return selected.map(({ documentId, blockId, reason }) => ({
      documentId,
      blockId,
      reason,
    }));
  };
}

function diversifyBySource<T extends { sourceId: string }>(items: T[], limit: number): T[] {
  const queues = new Map<string, T[]>();
  for (const item of items) {
    const queue = queues.get(item.sourceId);
    if (queue) queue.push(item);
    else queues.set(item.sourceId, [item]);
  }

  const result: T[] = [];
  while (result.length < limit) {
    let added = false;
    for (const queue of queues.values()) {
      const next = queue.shift();
      if (!next) continue;
      result.push(next);
      added = true;
      if (result.length >= limit) break;
    }
    if (!added) break;
  }
  return result;
}

function tokenize(value: string): string[] {
  return [...new Set(normalize(value).match(/[\p{L}\p{N}]+/gu) ?? [])].filter(
    (token) => token.length >= 2
  );
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr");
}
