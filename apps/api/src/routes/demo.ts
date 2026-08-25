import { Hono } from "hono";
import { getJudeofuturismeDemo } from "../services/demoService.js";

/** Contexte de démo : charges le contexte prêt à poster pour /api/diffract. */
export function demoRoutes(): Hono {
  const app = new Hono();

  app.get("/judeofuturisme", (c) => c.json(getJudeofuturismeDemo()));

  return app;
}