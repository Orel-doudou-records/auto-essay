import { z } from "zod";

export const ManuscriptUnitReferenceSchema = z.object({
  unitId: z.string().min(1),
  version: z.number().int().min(1),
  order: z.number().int().nonnegative(),
});

export type ManuscriptUnitReference = z.infer<
  typeof ManuscriptUnitReferenceSchema
>;

export const ManuscriptSchema = z
  .object({
    id: z.string(),
    projectId: z.string().min(1),
    title: z.string().min(1),
    units: z.array(ManuscriptUnitReferenceSchema),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .superRefine((manuscript, context) => {
    const references = new Set<string>();
    const orders = new Set<number>();
    let hasDuplicateReference = false;
    let hasDuplicateOrder = false;

    for (const unit of manuscript.units) {
      const reference = `${unit.unitId}\u0000${unit.version}`;

      if (references.has(reference)) {
        hasDuplicateReference = true;
      }
      references.add(reference);

      if (orders.has(unit.order)) {
        hasDuplicateOrder = true;
      }
      orders.add(unit.order);
    }

    if (hasDuplicateReference) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["units"],
        message: "A manuscript cannot reference the same unit version more than once",
      });
    }

    if (hasDuplicateOrder) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["units"],
        message: "A manuscript cannot contain multiple unit references at the same order",
      });
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
    units: [],
    ...partial,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  });
}
