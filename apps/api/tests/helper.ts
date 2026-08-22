import { createApp } from "../src/app.js";
import type { Hono } from "hono";
import os from "node:os";
import path from "node:path";

export function makeTestApp(dataDir?: string): Hono {
  if (dataDir) {
    process.env.AUTO_ESSAY_DATA_DIR = dataDir;
  }
  return createApp();
}

export function makeTempDataDir(): string {
  return path.join(os.tmpdir(), `auto-essay-test-${crypto.randomUUID()}`);
}

export async function postJson(app: Hono, path: string, body: unknown) {
  return app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function patchJson(app: Hono, path: string, body: unknown) {
  return app.request(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
