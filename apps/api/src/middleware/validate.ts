import type { Context, Next } from "hono";
import { type ZodSchema } from "zod";
import { HTTPException } from "hono/http-exception";

export function validateBody<T extends ZodSchema>(schema: T) {
  return async (c: Context, next: Next) => {
    const body = await c.req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new HTTPException(400, { message: parsed.error.message });
    }
    c.set("body", parsed.data);
    await next();
  };
}
