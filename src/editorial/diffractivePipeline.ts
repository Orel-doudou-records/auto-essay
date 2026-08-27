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

/**
 * Pipeline de lecture du « moteur de pensée ». Il diffracte un fragment et
 * peut attacher cette trace de raisonnement à une articulation candidate.
 * Il ne crée jamais de décision éditoriale.
 *
 *   fragment + livre → DiffractiveReader → DiffractiveReading
 *   → attachée à une ContentStyleArticulation (trace de raisonnement)
 *
 * L’`ArticulationResolver` (relations → articulations) reste en amont et hors
 * de cette classe : le pipeline consomme une articulation candidate déjà
 * résolue, il ne la fabrique pas. La décision appartient au service de
 * gouvernance et aux actes explicites de l’auteur.
 */
export class DiffractivePipeline {
  private readonly reader: DiffractiveReader;

  constructor(client: StructuredModelClient) {
    this.reader = createDiffractiveReader(client);
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


}

export function createDiffractivePipeline(
  client: StructuredModelClient
): DiffractivePipeline {
  return new DiffractivePipeline(client);
}
