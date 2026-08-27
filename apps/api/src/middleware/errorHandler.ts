import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import { logger } from "../observability/logger.js";

export async function errorHandler(err: Error, c: Context) {
  if (err instanceof HTTPException) {
    return c.json({ error: err.name, message: err.message }, err.status);
  }
  if (err instanceof ZodError) {
    return c.json({ error: "ValidationError", message: err.message }, 400);
  }
  logger.error("Erreur HTTP interne.", err, { method: c.req.method, path: c.req.path });
  return c.json({ error: "InternalError", message: err.message }, 500);
}
