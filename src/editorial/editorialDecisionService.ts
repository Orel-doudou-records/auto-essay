import { z } from "zod";
import {
  ContentStyleArticulationSchema,
  type ContentStyleArticulation,
} from "../domain/contentStyleArticulation";
import {
  EditorialDecisionSchema,
  createEditorialDecision,
  type CreateEditorialDecisionInput,
  type EditorialDecision,
} from "../domain/editorialDecision";

export const EditorialGovernanceEventSchema = z.object({
  id: z.string(),
  targetType: z.enum(["articulation", "decision"]),
  targetId: z.string().min(1),
  action: z.enum([
    "accepted",
    "modified",
    "rejected",
    "suspended",
    "revoked",
    "superseded",
  ]),
  fromStatus: z.string().min(1),
  toStatus: z.string().min(1),
  actor: z.literal("author"),
  note: z.string().min(1).optional(),
  createdAt: z.string().datetime(),
});

export type EditorialGovernanceEvent = z.infer<
  typeof EditorialGovernanceEventSchema
>;

export type DecisionCommitmentsInput = Omit<
  CreateEditorialDecisionInput,
  "projectId" | "version" | "supersedesDecisionId"
>;

export type ArticulationModification = Partial<
  Pick<
    ContentStyleArticulation,
    | "contentRelationIds"
    | "supportingObservationIds"
    | "stylisticOperations"
    | "intendedEffects"
    | "support"
    | "risks"
    | "alternatives"
  >
>;

export interface DecisionCreationResult {
  articulation: ContentStyleArticulation;
  decision: EditorialDecision;
  event: EditorialGovernanceEvent;
}

export interface ArticulationTransitionResult {
  articulation: ContentStyleArticulation;
  event: EditorialGovernanceEvent;
}

export interface DecisionTransitionResult {
  decision: EditorialDecision;
  event: EditorialGovernanceEvent;
}

export interface DecisionReplacementResult {
  previousDecision: EditorialDecision;
  decision: EditorialDecision;
  event: EditorialGovernanceEvent;
}

/**
 * Gouverne le passage d'une proposition non exécutable à une décision auteur.
 * Toutes les transitions sont immuables et accompagnées d'un événement.
 */
export class EditorialDecisionService {
  accept(
    articulation: ContentStyleArticulation,
    commitments: DecisionCommitmentsInput
  ): DecisionCreationResult {
    assertArticulationStatus(articulation, ["candidate", "suspended"], "accept");
    const accepted = updateArticulationStatus(articulation, "accepted");
    const decision = createEditorialDecision(accepted, {
      ...commitments,
      projectId: accepted.scope.projectId,
      version: 1,
    });

    return {
      articulation: accepted,
      decision,
      event: createGovernanceEvent({
        targetType: "articulation",
        targetId: articulation.id,
        action: "accepted",
        fromStatus: articulation.status,
        toStatus: accepted.status,
        note: commitments.validationNote,
      }),
    };
  }

  modify(
    articulation: ContentStyleArticulation,
    modification: ArticulationModification,
    commitments: DecisionCommitmentsInput
  ): DecisionCreationResult {
    assertArticulationStatus(
      articulation,
      ["candidate", "suspended", "accepted", "modified"],
      "modify"
    );

    const modified = ContentStyleArticulationSchema.parse({
      ...articulation,
      ...modification,
      status: "modified",
      updatedAt: new Date().toISOString(),
    });
    const decision = createEditorialDecision(modified, {
      ...commitments,
      projectId: modified.scope.projectId,
      version: 1,
    });

    return {
      articulation: modified,
      decision,
      event: createGovernanceEvent({
        targetType: "articulation",
        targetId: articulation.id,
        action: "modified",
        fromStatus: articulation.status,
        toStatus: modified.status,
        note: commitments.validationNote,
      }),
    };
  }

  reject(
    articulation: ContentStyleArticulation,
    note?: string
  ): ArticulationTransitionResult {
    assertArticulationStatus(articulation, ["candidate", "suspended"], "reject");
    const rejected = updateArticulationStatus(articulation, "rejected");

    return {
      articulation: rejected,
      event: createGovernanceEvent({
        targetType: "articulation",
        targetId: articulation.id,
        action: "rejected",
        fromStatus: articulation.status,
        toStatus: rejected.status,
        note,
      }),
    };
  }

  suspend(
    articulation: ContentStyleArticulation,
    note?: string
  ): ArticulationTransitionResult {
    assertArticulationStatus(articulation, ["candidate"], "suspend");
    const suspended = updateArticulationStatus(articulation, "suspended");

    return {
      articulation: suspended,
      event: createGovernanceEvent({
        targetType: "articulation",
        targetId: articulation.id,
        action: "suspended",
        fromStatus: articulation.status,
        toStatus: suspended.status,
        note,
      }),
    };
  }

  revoke(
    decision: EditorialDecision,
    note?: string
  ): DecisionTransitionResult {
    assertDecisionActive(decision, "revoke");
    const revoked = EditorialDecisionSchema.parse({
      ...decision,
      status: "revoked",
      updatedAt: new Date().toISOString(),
    });

    return {
      decision: revoked,
      event: createGovernanceEvent({
        targetType: "decision",
        targetId: decision.id,
        action: "revoked",
        fromStatus: decision.status,
        toStatus: revoked.status,
        note,
      }),
    };
  }

  replace(
    currentDecision: EditorialDecision,
    articulation: ContentStyleArticulation,
    commitments: DecisionCommitmentsInput
  ): DecisionReplacementResult {
    assertDecisionActive(currentDecision, "replace");

    if (currentDecision.projectId !== articulation.scope.projectId) {
      throw new Error("A replacement decision must belong to the same project");
    }

    if (articulation.status !== "accepted" && articulation.status !== "modified") {
      throw new Error(
        `Articulation ${articulation.id} must be accepted or modified before replacing a decision`
      );
    }

    const now = new Date().toISOString();
    const previousDecision = EditorialDecisionSchema.parse({
      ...currentDecision,
      status: "superseded",
      updatedAt: now,
    });
    const decision = createEditorialDecision(articulation, {
      ...commitments,
      projectId: currentDecision.projectId,
      version: currentDecision.version + 1,
      supersedesDecisionId: currentDecision.id,
    });

    return {
      previousDecision,
      decision,
      event: createGovernanceEvent({
        targetType: "decision",
        targetId: currentDecision.id,
        action: "superseded",
        fromStatus: currentDecision.status,
        toStatus: previousDecision.status,
        note: commitments.validationNote,
      }),
    };
  }
}

export function createEditorialDecisionService(): EditorialDecisionService {
  return new EditorialDecisionService();
}

function updateArticulationStatus(
  articulation: ContentStyleArticulation,
  status: ContentStyleArticulation["status"]
): ContentStyleArticulation {
  return ContentStyleArticulationSchema.parse({
    ...articulation,
    status,
    updatedAt: new Date().toISOString(),
  });
}

function assertArticulationStatus(
  articulation: ContentStyleArticulation,
  allowedStatuses: ContentStyleArticulation["status"][],
  action: string
): void {
  if (!allowedStatuses.includes(articulation.status)) {
    throw new Error(
      `Cannot ${action} articulation ${articulation.id} from status ${articulation.status}`
    );
  }
}

function assertDecisionActive(
  decision: EditorialDecision,
  action: string
): void {
  if (decision.status !== "active") {
    throw new Error(
      `Cannot ${action} decision ${decision.id} from status ${decision.status}`
    );
  }
}

function createGovernanceEvent(input: {
  targetType: EditorialGovernanceEvent["targetType"];
  targetId: string;
  action: EditorialGovernanceEvent["action"];
  fromStatus: string;
  toStatus: string;
  note?: string;
}): EditorialGovernanceEvent {
  return EditorialGovernanceEventSchema.parse({
    id: crypto.randomUUID(),
    ...input,
    actor: "author",
    createdAt: new Date().toISOString(),
  });
}
