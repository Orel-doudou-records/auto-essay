import {
  createDiffractiveBatchRunner,
  createDiffractivePipeline,
  type BookPartInput,
  type ContentStyleArticulation,
  type DecisionCommitmentsInput,
  type DiffractiveBatchFragment,
  type DiffractiveBatchResult,
  type DiffractiveReading,
  type ExistingCutInput,
  type FragmentDecisionResult,
  type StructuredModelClient,
} from "@auto-essay/core";

export interface DiffractContext {
  book?: string;
  bookParts?: BookPartInput[];
  existingCuts?: ExistingCutInput[];
  concepts?: Array<{ label: string; definition: string }>;
  tensions?: Array<{ label: string; description: string }>;
}

export interface DiffractInput {
  statement: string;
  claimIds?: string[];
  sourceIds?: string[];
  book?: string;
  bookParts?: BookPartInput[];
  existingCuts?: ExistingCutInput[];
  concepts?: Array<{ label: string; definition: string }>;
  tensions?: Array<{ label: string; description: string }>;
}

export interface DiffractBatchInput {
  fragments: DiffractiveBatchFragment[];
  book?: string;
  bookParts?: BookPartInput[];
  existingCuts?: ExistingCutInput[];
  concepts?: Array<{ label: string; definition: string }>;
  tensions?: Array<{ label: string; description: string }>;
}

export interface DiffractivePipelineInput {
  fragment: DiffractiveBatchFragment;
  articulation: ContentStyleArticulation;
  commitments: DecisionCommitmentsInput;
  context?: DiffractContext;
}

/**
 * Façade applicative : expose le moteur de pensée (diffract simple, par lot,
 * et pipeline complet) derrière un client structuré injecté.
 */
export class DiffractionService {
  private readonly pipeline: ReturnType<typeof createDiffractivePipeline>;
  private readonly batch: ReturnType<typeof createDiffractiveBatchRunner>;

  constructor(client: StructuredModelClient) {
    this.pipeline = createDiffractivePipeline(client);
    this.batch = createDiffractiveBatchRunner(client);
  }

  async diffract(input: DiffractInput): Promise<DiffractiveReading> {
    return this.pipeline.diffract(
      {
        statement: input.statement,
        claimIds: input.claimIds,
        sourceIds: input.sourceIds,
      },
      {
        book: input.book,
        bookParts: input.bookParts,
        existingCuts: input.existingCuts,
        concepts: input.concepts,
        tensions: input.tensions,
      }
    );
  }

  async diffractBatch(input: DiffractBatchInput): Promise<DiffractiveBatchResult> {
    return this.batch.run({
      fragments: input.fragments,
      book: input.book,
      bookParts: input.bookParts,
      existingCuts: input.existingCuts,
      concepts: input.concepts,
      tensions: input.tensions,
    });
  }

  async runPipeline(
    input: DiffractivePipelineInput
  ): Promise<FragmentDecisionResult> {
    return this.pipeline.runFragment(
      {
        statement: input.fragment.statement,
        claimIds: input.fragment.claimIds,
        sourceIds: input.fragment.sourceIds,
      },
      input.articulation,
      input.commitments,
      input.context ?? {}
    );
  }
}
