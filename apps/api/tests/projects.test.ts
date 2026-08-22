import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { makeTestApp, makeTempDataDir, postJson, patchJson } from "./helper.js";
import fs from "node:fs/promises";

describe("projects routes", () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = makeTempDataDir();
  });

  afterEach(async () => {
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  it("lists empty projects", async () => {
    const app = makeTestApp(dataDir);
    const res = await app.request("/api/projects");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.projects).toEqual([]);
  });

  it("creates and retrieves a project", async () => {
    const app = makeTestApp(dataDir);
    const createRes = await postJson(app, "/api/projects", { title: "Mon essai" });
    expect(createRes.status).toBe(201);
    const { project } = await createRes.json();
    expect(project.title).toBe("Mon essai");

    const getRes = await app.request(`/api/projects/${project.id}`);
    expect(getRes.status).toBe(200);
    const { project: got } = await getRes.json();
    expect(got.id).toBe(project.id);
  });

  it("updates a project", async () => {
    const app = makeTestApp(dataDir);
    const { project } = await (await postJson(app, "/api/projects", { title: "A" })).json();
    const res = await patchJson(app, `/api/projects/${project.id}`, { title: "B" });
    expect(res.status).toBe(200);
    const { project: updated } = await res.json();
    expect(updated.title).toBe("B");
  });

  it("deletes a project", async () => {
    const app = makeTestApp(dataDir);
    const { project } = await (await postJson(app, "/api/projects", { title: "A" })).json();
    const delRes = await app.request(`/api/projects/${project.id}`, { method: "DELETE" });
    expect(delRes.status).toBe(200);
    const getRes = await app.request(`/api/projects/${project.id}`);
    expect(getRes.status).toBe(404);
  });
});
