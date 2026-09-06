import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  createDraftUnit,
  createManuscript,
  createManuscriptLeaf,
  createManuscriptNode,
  previewMarkdownManuscript,
  type DraftUnit,
  type ManuscriptChild,
  type ManuscriptImportAnnotation,
  type ManuscriptImportPreview,
  type ManuscriptNode,
} from "@auto-essay/core";
import { ConfirmManuscriptImportBodySchema, PreviewManuscriptImportBodySchema } from "../schemas/manuscriptImport.js";
import { getWorkspace, putWorkspace } from "../services/editorialWorkspaceStore.js";
import { getProject } from "../services/projectStore.js";
import { listUnits, replaceUnitsWhileLocked } from "../services/unitStore.js";
import { withProjectWriteLock } from "../services/projectWriteLock.js";

export function manuscriptImportRoutes(): Hono {
  const app = new Hono();

  app.post("/preview", async (c) => {
    const projectId = c.req.param("projectId") as string;
    await getProject(projectId);
    const parsed = PreviewManuscriptImportBodySchema.safeParse(await c.req.json());
    if (!parsed.success) {
      throw new HTTPException(400, { message: "Le fichier Markdown dépasse 5 Mo ou son nom est invalide." });
    }
    const body = parsed.data;
    if (!body.name.toLowerCase().endsWith(".md")) {
      throw new HTTPException(400, { message: "Seuls les fichiers Markdown (.md) sont pris en charge pour le moment." });
    }
    if (!body.content.trim()) {
      throw new HTTPException(400, { message: "Le manuscrit est vide." });
    }
    try {
      return c.json({ preview: previewMarkdownManuscript(body.name, body.content) });
    } catch (error) {
      throw new HTTPException(400, {
        message: error instanceof Error ? error.message : "Le manuscrit ne peut pas être lu.",
      });
    }
  });

  app.post("/confirm", async (c) => {
    const projectId = c.req.param("projectId") as string;
    await getProject(projectId);
    const parsed = ConfirmManuscriptImportBodySchema.safeParse(await c.req.json());
    if (!parsed.success) {
      throw new HTTPException(400, {
        message: "L’aperçu doit contenir un titre de manuscrit et un titre pour chaque section, sans dépasser 5 Mo.",
      });
    }
    const { preview } = parsed.data;
    return withProjectWriteLock(projectId, async () => {
      const existingUnits = await listUnits(projectId);
      const workspaceExists = await hasWorkspace(projectId);
      if (existingUnits.length > 0 || workspaceExists) {
        throw new HTTPException(409, { message: "Le projet contient déjà un manuscrit ou des unités." });
      }

      const units = preview.sections.map((section) =>
        createDraftUnit({
          projectId,
          granularity: "section",
          thesis: section.title,
          contextInPlan: { section: section.id },
          content: section.content,
          evidencePack: { sourceIds: [], keyCitations: [], supportingClaimIds: [], objections: [] },
        })
      );
      const manuscript = createManuscript({
        projectId,
        title: preview.title,
        tree: buildManuscriptTree(preview, units),
      });

      await replaceUnitsWhileLocked(projectId, units);
      try {
        await putWorkspace(projectId, {
          manuscript,
          distribution: [],
          profiles: [],
          articulations: [],
        });
      } catch (error) {
        await replaceUnitsWhileLocked(projectId, existingUnits);
        throw error;
      }

      return c.json({ manuscript, units }, 201);
    });
  });

  return app;
}

async function hasWorkspace(projectId: string): Promise<boolean> {
  try {
    await getWorkspace(projectId);
    return true;
  } catch (error) {
    if (error instanceof HTTPException && error.status === 404) return false;
    throw error;
  }
}

function buildManuscriptTree(preview: ManuscriptImportPreview, units: DraftUnit[]): ManuscriptChild[] {
  const roots: ManuscriptChild[] = [];
  const ancestors: Array<{ level: number; node: ManuscriptNode }> = [];

  preview.sections.forEach((section, index) => {
    const unit = units[index];
    const node = createManuscriptNode({
      id: section.id,
      title: section.title,
      notes: section.annotations.map(toImportedNote),
      children: [createManuscriptLeaf(unit.id, unit.version)],
    });
    while (ancestors.at(-1)?.level !== undefined && ancestors.at(-1)!.level >= section.level) {
      ancestors.pop();
    }
    const parent = ancestors.at(-1)?.node;
    if (parent) parent.children.push(node);
    else roots.push(node);
    ancestors.push({ level: section.level, node });
  });

  return roots;
}

function toImportedNote(annotation: ManuscriptImportAnnotation) {
  return {
    kind: "human" as const,
    text:
      annotation.kind === "link"
        ? `Import — lien : ${annotation.label} (${annotation.url})`
        : `Import — commentaire : ${annotation.content}`,
    createdAt: new Date().toISOString(),
  };
}
