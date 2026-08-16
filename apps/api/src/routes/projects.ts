import { Hono } from "hono";
import {
  listProjects,
  getProject,
  createNewProject,
  updateProject,
  deleteProject,
} from "../services/projectStore.js";
import { CreateProjectBodySchema, UpdateProjectBodySchema } from "../schemas/projects.js";

export function projectsRoutes(): Hono {
  const app = new Hono();

  app.get("/", async (c) => {
    const projects = await listProjects();
    return c.json({ projects });
  });

  app.post("/", async (c) => {
    const body = CreateProjectBodySchema.parse(await c.req.json());
    const project = await createNewProject(body);
    return c.json({ project }, 201);
  });

  app.get("/:projectId", async (c) => {
    const project = await getProject(c.req.param("projectId") as string);
    return c.json({ project });
  });

  app.patch("/:projectId", async (c) => {
    const body = UpdateProjectBodySchema.parse(await c.req.json());
    const project = await updateProject(c.req.param("projectId") as string, body);
    return c.json({ project });
  });

  app.delete("/:projectId", async (c) => {
    await deleteProject(c.req.param("projectId") as string);
    return c.json({ deleted: true });
  });

  return app;
}
