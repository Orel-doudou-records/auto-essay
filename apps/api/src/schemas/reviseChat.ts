import { z } from "zod";

export const ReviseChatBodySchema = z.object({
  instruction: z.string().min(1),
});
