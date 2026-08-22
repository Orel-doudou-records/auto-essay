import { Hono } from "hono";
import { importMarkdownFiles, importBibTeX, type Source } from "@auto-essay/core";
import { listSources, addSources, getSource, updateSource, deleteSource } from "../services/sourceStore.js";
import { ImportSourcesBodySchema, UpdateSourceBodySchema } from "../schemas/sources.js";

export function sourcesRoutes(): Hono {
  const app = new Hono();

  app.get("/", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const sources = await listSources(projectId);
    return c.json({ sources });
  });

  app.post("/import", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const { files } = ImportSourcesBodySchema.parse(await c.req.json());
    const imported: Source[] = [];
    const errors: Array<{ file: string; message: string }> = [];

    for (const file of files) {
      try {
        if (file.name.endsWith(".bib")) {
          const result = importBibTeX(file.content, projectId);
          imported.push(...result.sources);
          errors.push(...result.errors.map((e) => ({ file: e.file, message: e.message })));
        } else if (file.name.endsWith(".md")) {
          const result = importMarkdownFiles([{ path: file.name, content: file.content }], projectId);
          imported.push(...result.sources);
          errors.push(...result.errors.map((e) => ({ file: e.file, message: e.message })));
        } else {
          errors.push({ file: file.name, message: "unsupported file type" });
        }
      } catch (err) {
        errors.push({ file: file.name, message: (err as Error).message });
      }
    }

    if (imported.length > 0) {
      await addSources(projectId, imported);
    }

    return c.json({ imported: imported.length, errors });
  });

  app.get("/:sourceId", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const source = await getSource(projectId, c.req.param("sourceId") as string);
    if (!source) return c.json({ error: "source not found" }, 404);
    return c.json({ source });
  });

  app.patch("/:sourceId", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const body = UpdateSourceBodySchema.parse(await c.req.json());
    const source = await updateSource(projectId, c.req.param("sourceId") as string, body);
    if (!source) return c.json({ error: "source not found" }, 404);
    return c.json({ source });
  });

  app.delete("/:sourceId", async (c) => {
    const projectId = c.req.param("projectId") as string;
    const ok = await deleteSource(projectId, c.req.param("sourceId") as string);
    if (!ok) return c.json({ error: "source not found" }, 404);
    return c.json({ deleted: true });
  });

  return app;
}
