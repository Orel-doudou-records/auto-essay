import { z } from "zod";

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
  children?: ManuscriptChildInput[];
};

/**
 * Nœud de l'arbre : une partie du livre (acte, chapitre, section), à
 * profondeur libre. `text` est optionnel : un préambule d'acte est un état
 * légitime ; une partie sans texte ni feuille est planifiée (ADR-006, D7).
 */
export type ManuscriptNode = {
  kind: "node";
  id: string;
  title: string;
  text?: string;
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