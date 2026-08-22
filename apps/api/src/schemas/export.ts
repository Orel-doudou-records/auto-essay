import { z } from "zod";

export const ExportBodySchema = z.object({
  unitIds: z.array(z.string()).optional(),
});
