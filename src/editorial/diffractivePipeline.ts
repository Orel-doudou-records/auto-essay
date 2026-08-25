import type { StructuredModelClient } from "../evaluation/evaluateEssay";
import {
  ContentStyleArticulationSchema,
  type ContentStyleArticulation,
} from "../domain/contentStyleArticulation";
import type { DiffractiveReading } from "../domain/diffractiveReading";
import {
  createDiffractiveReader,
  type BookBibliographyInput,
  type BookPartInput,
  type BookPlanInput,
  type DiffractiveReader,
  type ExistingCutInput,
} from "./diffractiveReader";
import {
  createEditorialDecisionService,
  type DecisionCommitmentsInput,
  type DecisionCreationResult,
  type EditorialDecisionService,
} from "./editorialDecisionService";

/**
 * Fragment posé dans le livre, à diffracter puis à faire décider.
 * La position (statement) porte la claim en formation ; claimIds/sourceIds
 * référencent des claims et sources déjà persistés.
 */
export interface DiffractivePipelineFragment {
  statement: string;
  claimIds?: string[];
  sourceIds?: string[];
}

export interface DiffractiveContext {
  book?: string;
  bookParts?: BookPartInput[];
  existingCuts?: ExistingCutInput[];
  bookPlan?: BookPlanInput[];
  bookBibliography?: BookBibliographyInput;
  concepts?: Array<{ label: string; definition: string }>;
  tensions?: Array<{ label: string; description: string }>;
}

export type FragmentDecisionResult = DecisionCreationResult & {
  reading: DiffractiveReading;
};

/**
 * Pipeline permanent du « moteur de pensée » : relie la lecture diffractive
 * à la décision éditoriale, sans jamais court-circuiter la validation auteur.
 *
 *   fragment + livre → DiffractiveReader → DiffractiveReading
 *   → attaché à une ContentStyleArticulation (trace de raisonnement)
 *   → acceptée par l'auteur via EditorialDecisionService → EditorialDecision
 *     (la coupe `cut` est dérivée de `diffractiveReading.pass4`).
 *
 * Le `ArticulationResolver` (relations → articulations) reste en amont et hors
 * de cette classe : le pipeline consomme une articulation candidate déjà
 * résolue, il ne la fabrique pas.
 */
export class DiffractivePipeline {
  private readonly reader: DiffractiveReader;
  private readonly governance: EditorialDecisionService;

  constructor(client: StructuredModelClient) {
    this.reader = createDiffractiveReader(client);
    this.governance = createEditorialDecisionService();
  }

  /** 1. Diffracte un fragment dans le livre → lecture diffractive. */
  async diffract(
    fragment: DiffractivePipelineFragment,
    context: DiffractiveContext = {}
  ): Promise<DiffractiveReading> {
    return this.reader.read({
      statement: fragment.statement,
      claimIds: fragment.claimIds,
      sourceIds: fragment.sourceIds,
      book: context.book,
      bookParts: context.bookParts,
      existingCuts: context.existingCuts,
      bookPlan: context.bookPlan,
      bookBibliography: context.bookBibliography,
      concepts: context.concepts,
      tensions: context.tensions,
    });
  }

  /** 2. Attache la lecture à une articulation (immutable, statut conservé). */
  attachReading(
    articulation: ContentStyleArticulation,
    reading: DiffractiveReading
  ): ContentStyleArticulation {
    return ContentStyleArticulationSchema.parse({
      ...articulation,
      diffractiveReading: reading,
      updatedAt: new Date().toISOString(),
    });
  }

  /** 3. L'auteur accepte une articulation candidate → décision (cut dérivé). */
  accept(
    articulation: ContentStyleArticulation,
    commitments: DecisionCommitmentsInput
  ): DecisionCreationResult {
    return this.governance.accept(articulation, commitments);
  }

  /** Chemin complet, en un appel : diffracte, attache, accepte. */
  async runFragment(
    fragment: DiffractivePipelineFragment,
    articulation: ContentStyleArticulation,
    commitments: DecisionCommitmentsInput,
    context: DiffractiveContext = {}
  ): Promise<FragmentDecisionResult> {
    const reading = await this.diffract(fragment, context);
    const enriched = this.attachReading(articulation, reading);
    const decision = this.accept(enriched, commitments);
    return { ...decision, reading };
  }
}

export function createDiffractivePipeline(
  client: StructuredModelClient
): DiffractivePipeline {
  return new DiffractivePipeline(client);
}
