import {
  createDiffractiveBatchRunner,
  createDiffractivePipeline,
  type BookBibliographyInput,
  type BookPartInput,
  type BookPlanInput,
  type DiffractiveBatchFragment,
  type DiffractiveBatchResult,
  type DiffractiveReading,
  type ExistingCutInput,
  type StructuredModelClient,
} from "@auto-essay/core";

export interface DiffractContext {
  book?: string;
  bookParts?: BookPartInput[];
  bookPlan?: BookPlanInput[];
  existingCuts?: ExistingCutInput[];
  bookBibliography?: BookBibliographyInput;
  concepts?: Array<{ label: string; definition: string }>;
  tensions?: Array<{ label: string; description: string }>;
}

export interface DiffractInput {
  statement: string;
  claimIds?: string[];
  sourceIds?: string[];
  book?: string;
  bookParts?: BookPartInput[];
  bookPlan?: BookPlanInput[];
  existingCuts?: ExistingCutInput[];
  bookBibliography?: BookBibliographyInput;
  concepts?: Array<{ label: string; definition: string }>;
  tensions?: Array<{ label: string; description: string }>;
}

export interface DiffractBatchInput {
  fragments: DiffractiveBatchFragment[];
  book?: string;
  bookParts?: BookPartInput[];
  bookPlan?: BookPlanInput[];
  existingCuts?: ExistingCutInput[];
  bookBibliography?: BookBibliographyInput;
  concepts?: Array<{ label: string; definition: string }>;
  tensions?: Array<{ label: string; description: string }>;
}

/**
 * Façade applicative : expose des lectures diffractives simples et par lot
 * derrière un client structuré injecté.
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
        bookPlan: input.bookPlan,
        bookBibliography: input.bookBibliography,
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
      bookPlan: input.bookPlan,
      bookBibliography: input.bookBibliography,
      concepts: input.concepts,
      tensions: input.tensions,
    });
  }

}
