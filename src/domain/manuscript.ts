import { z } from "zod";

/**
 * Auteur d'une note de plan : l'humain ou l'agent.
 */
export const PlanNoteKindSchema = z.enum(["human", "agent"]);

export type PlanNoteKind = z.infer<typeof PlanNoteKindSchema>;

/**
 * Note / commentaire sur un chapitre ou un paragraphe de plan : un fil
 * Humain + Agent (idées, résumés synthétiques), dans l'ordre chronologique.
 */
export const PlanNoteSchema = z.object({
  kind: PlanNoteKindSchema,
  text: z.string().min(1),
  createdAt: z.string().datetime(),
});

export type PlanNote = z.infer<typeof PlanNoteSchema>;
export type PlanNoteInput = z.input<typeof PlanNoteSchema>;

/**
 * Entrée de plan : un paragraphe prévu d'un chapitre. La position dans
 * `plan[]` est l'ordre (cohérent ADR-006, D10 — pas de champ `order`).
 * `subject` = intitulé court ; `preview` = aperçu régénérable produit par
 * le modèle ; `notes` = fil humain/agent. Quand le paragraphe est écrit,
 * l'entrée devient une feuille liée — elle n'est pas détruite.
 */
export const PlanEntrySchema = z
  .object({
    id: z.string().min(1),
    subject: z.string().min(1),
    preview: z.string().optional(),
    notes: z.array(PlanNoteSchema).default([]),
    /**
     * Référence à l'unité rédigée qui réalise ce paragraphe. L'entrée n'est
     * jamais détruite : c'est la trace du plan (spec E, E4).
     */
    unitId: z.string().min(1).optional(),
    unitVersion: z.number().int().min(1).optional(),
  })
  .superRefine((entry, context) => {
    if ((entry.unitId === undefined) !== (entry.unitVersion === undefined)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["unitVersion"],
        message: "unitId and unitVersion must be set together",
      });
    }
  });

export type PlanEntry = z.infer<typeof PlanEntrySchema>;
export type PlanEntryInput = z.input<typeof PlanEntrySchema>;

/**
 * Feuille de l'arbre : référence à une version précise d'unité.
 * Le statut lu par le diffract est celui de la version pointée (ADR-006, D4).
 */
export const ManuscriptLeafSchema = z.object({
  kind: z.literal("leaf"),
  unitId: z.string().min(1),
  version: z.number().int().min(1),
});

export type ManuscriptLeaf = z.infer<typeof ManuscriptLeafSchema>;

export type ManuscriptChild = ManuscriptNode | ManuscriptLeaf;

export type ManuscriptNodeInput = {
  kind: "node";
  id: string;
  title: string;
  text?: string;
  plan?: PlanEntryInput[];
  notes?: PlanNoteInput[];
  children?: ManuscriptChildInput[];
};

/**
 * Nœud de l'arbre : une partie du livre (acte, chapitre, section), à
 * profondeur libre. `text` est optionnel : un préambule d'acte est un état
 * légitime ; une partie sans texte ni feuille est planifiée (ADR-006, D7).
 * `plan` = le plan d'ébauche du chapitre (paragraphes prévus, dans l'ordre) ;
 * `notes` = fil de commentaires humain/agent sur le chapitre.
 */
export type ManuscriptNode = {
  kind: "node";
  id: string;
  title: string;
  text?: string;
  plan?: PlanEntry[];
  notes?: PlanNote[];
  children: ManuscriptChild[];
};

export const ManuscriptNodeSchema: z.ZodType<
  ManuscriptNode,
  z.ZodTypeDef,
  ManuscriptNodeInput
> = z.lazy(() =>
  z.object({
    kind: z.literal("node"),
    id: z.string().min(1),
    title: z.string().min(1),
    text: z.string().optional(),
    plan: z.array(PlanEntrySchema).optional(),
    notes: z.array(PlanNoteSchema).optional(),
    children: z.array(ManuscriptChildSchema).default([]),
  })
);

export type ManuscriptChildInput = ManuscriptNodeInput | ManuscriptLeaf;

export const ManuscriptChildSchema: z.ZodType<
  ManuscriptChild,
  z.ZodTypeDef,
  ManuscriptChildInput
> = z.union([
  ManuscriptNodeSchema,
  ManuscriptLeafSchema,
]);

/**
 * Le manuscrit, en tant que livre en cours d'écriture : la structure EST le
 * livre (ADR-006, D1). La position dans `tree` est l'ordre — plus de champ
 * `order` plat (ADR-006, D10).
 */
export const ManuscriptSchema = z
  .object({
    id: z.string(),
    projectId: z.string().min(1),
    title: z.string().min(1),
    tree: z.array(ManuscriptChildSchema),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .superRefine((manuscript, context) => {
    const nodeIds = new Set<string>();
    for (const id of collectNodeIds(manuscript.tree)) {
      if (nodeIds.has(id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tree"],
          message: `Manuscript node id '${id}' is duplicated`,
        });
      }
      nodeIds.add(id);
    }

    const planEntryIds = new Set<string>();
    for (const id of collectPlanEntryIds(manuscript.tree)) {
      if (planEntryIds.has(id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tree"],
          message: `Plan entry id '${id}' is duplicated`,
        });
      }
      planEntryIds.add(id);
    }

    const references = new Set<string>();
    for (const leaf of collectLeafReferences(manuscript.tree)) {
      const reference = `${leaf.unitId}\u0000${leaf.version}`;
      if (references.has(reference)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tree"],
          message:
            "A manuscript cannot reference the same unit version more than once",
        });
      }
      references.add(reference);
    }
  });

export type Manuscript = z.infer<typeof ManuscriptSchema>;

export function createManuscript(
  partial: Omit<Partial<Manuscript>, "id" | "createdAt" | "updatedAt"> & {
    projectId: string;
    title: string;
  }
): Manuscript {
  const now = new Date().toISOString();

  return ManuscriptSchema.parse({
    tree: [],
    ...partial,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  });
}

export function createManuscriptNode(
  input: {
    id: string;
    title: string;
    text?: string;
    plan?: PlanEntryInput[];
    notes?: PlanNoteInput[];
    children?: ManuscriptChild[];
  }
): ManuscriptNode {
  return ManuscriptNodeSchema.parse({
    kind: "node",
    children: [],
    ...input,
  });
}

export function createManuscriptLeaf(
  unitId: string,
  version: number
): ManuscriptLeaf {
  return ManuscriptLeafSchema.parse({ kind: "leaf", unitId, version });
}

export function createPlanNote(kind: PlanNoteKind, text: string): PlanNote {
  return PlanNoteSchema.parse({
    kind,
    text,
    createdAt: new Date().toISOString(),
  });
}

export function createPlanEntry(
  subject: string,
  partial: Partial<Omit<PlanEntry, "id" | "subject">> = {}
): PlanEntry {
  return PlanEntrySchema.parse({
    id: crypto.randomUUID(),
    subject,
    notes: [],
    ...partial,
  });
}

/** Tous les ids de nœuds, dans l'ordre du parcours en profondeur. */
export function collectNodeIds(
  parts: ManuscriptChild[],
  acc: string[] = []
): string[] {
  for (const part of parts) {
    if (part.kind === "node") {
      acc.push(part.id);
      collectNodeIds(part.children, acc);
    }
  }
  return acc;
}

/** Toutes les entrées de plan de l'arbre, dans l'ordre du parcours. */
export function collectPlanEntries(
  parts: ManuscriptChild[],
  acc: PlanEntry[] = []
): PlanEntry[] {
  for (const part of parts) {
    if (part.kind === "node") {
      if (part.plan) acc.push(...part.plan);
      collectPlanEntries(part.children, acc);
    }
  }
  return acc;
}

/** Tous les ids d'entrées de plan, dans l'ordre du parcours. */
export function collectPlanEntryIds(
  parts: ManuscriptChild[],
  acc: string[] = []
): string[] {
  for (const part of parts) {
    if (part.kind === "node") {
      if (part.plan) {
        for (const entry of part.plan) acc.push(entry.id);
      }
      collectPlanEntryIds(part.children, acc);
    }
  }
  return acc;
}

/** Toutes les feuilles (références d'unité), dans l'ordre de l'arbre. */
export function collectLeafReferences(
  parts: ManuscriptChild[],
  acc: ManuscriptLeaf[] = []
): ManuscriptLeaf[] {
  for (const part of parts) {
    if (part.kind === "leaf") acc.push(part);
    else collectLeafReferences(part.children, acc);
  }
  return acc;
}