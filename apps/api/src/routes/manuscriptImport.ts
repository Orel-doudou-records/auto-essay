import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  createDraftUnit,
  createManuscript,
  createManuscriptLeaf,
  createManuscriptNode,
  createPlanEntry,
  applyManuscriptReimport,
  compareManuscriptReimport,
  previewDocxHtml,
  previewMarkdownManuscript,
  previewOdtDocument,
  type DraftUnit,
  type ManuscriptChild,
  type ManuscriptImportAnnotation,
  type ManuscriptImportPreview,
  type ManuscriptNode,
} from "@auto-essay/core";
import mammoth from "mammoth";
import {
  ConfirmManuscriptImportBodySchema,
  ConfirmPlanImportBodySchema,
  ConfirmManuscriptReimportBodySchema,
  PreviewManuscriptImportBodySchema,
} from "../schemas/manuscriptImport.js";
import { getWorkspace, putWorkspaceWhileLocked } from "../services/editorialWorkspaceStore.js";
import { getProject } from "../services/projectStore.js";
import { listUnits, replaceUnitsWhileLocked } from "../services/unitStore.js";
import { withProjectWriteLock } from "../services/projectWriteLock.js";
import { assertSafeZipArchive, readSafeZipEntries } from "../services/safeZipArchive.js";

export function manuscriptImportRoutes(): Hono {
  const app = new Hono();

  app.post("/preview", async (c) => {
    const projectId = c.req.param("projectId") as string;
    await getProject(projectId);
    const parsed = PreviewManuscriptImportBodySchema.safeParse(await c.req.json());
    if (!parsed.success) throw new HTTPException(400, { message: "Le fichier dépasse 5 Mo ou son nom est invalide." });
    try {
      return c.json(await preparePreview(parsed.data));
    } catch (error) {
      throw new HTTPException(400, {
        message: error instanceof Error ? error.message : "Le manuscrit ne peut pas être lu.",
      });
    }
  });

  app.post("/reimport-preview", async (c) => {
    const projectId = c.req.param("projectId") as string;
    await getProject(projectId);
    const parsed = PreviewManuscriptImportBodySchema.safeParse(await c.req.json());
    if (!parsed.success) throw new HTTPException(400, { message: "Le fichier dépasse 5 Mo ou son nom est invalide." });
    try {
      const workspace = await getWorkspace(projectId);
      const prepared = await preparePreview(parsed.data);
      return c.json({
        ...prepared,
        comparison: compareManuscriptReimport(workspace.manuscript, prepared.preview),
      });
    } catch (error) {
      if (error instanceof HTTPException && error.status === 404) {
        throw new HTTPException(409, { message: "Importez d’abord un manuscrit avant de réimporter une version." });
      }
      throw new HTTPException(400, {
        message: error instanceof Error ? error.message : "Le manuscrit ne peut pas être lu.",
      });
    }
  });

  app.post("/plan-preview", async (c) => {
    const projectId = c.req.param("projectId") as string;
    await getProject(projectId);
    const parsed = PreviewManuscriptImportBodySchema.safeParse(await c.req.json());
    if (!parsed.success) throw new HTTPException(400, { message: "Le fichier dépasse 5 Mo ou son nom est invalide." });
    try {
      return c.json(await preparePreview(parsed.data));
    } catch (error) {
      throw new HTTPException(400, {
        message: error instanceof Error ? error.message : "Le plan ne peut pas être lu.",
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
        await putWorkspaceWhileLocked(projectId, {
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

  app.post("/plan-confirm", async (c) => {
    const projectId = c.req.param("projectId") as string;
    await getProject(projectId);
    const parsed = ConfirmPlanImportBodySchema.safeParse(await c.req.json());
    if (!parsed.success) {
      throw new HTTPException(400, { message: "L’aperçu doit contenir un titre de plan et une partie, un chapitre ou une section." });
    }
    const { preview } = parsed.data;
    return withProjectWriteLock(projectId, async () => {
      const existingUnits = await listUnits(projectId);
      const workspaceExists = await hasWorkspace(projectId);
      if (existingUnits.length > 0 || workspaceExists) {
        throw new HTTPException(409, { message: "Le projet contient déjà un manuscrit ou des sections." });
      }
      const manuscript = createManuscript({
        projectId,
        title: preview.title,
        tree: buildPlannedManuscriptTree(preview),
      });
      await putWorkspaceWhileLocked(projectId, {
        manuscript,
        distribution: [],
        profiles: [],
        articulations: [],
      });
      return c.json({ manuscript, units: [] }, 201);
    });
  });

  app.post("/reimport-confirm", async (c) => {
    const projectId = c.req.param("projectId") as string;
    await getProject(projectId);
    const parsed = ConfirmManuscriptReimportBodySchema.safeParse(await c.req.json());
    if (!parsed.success) {
      throw new HTTPException(400, { message: "Choisissez une action valide pour chaque section de l’aperçu." });
    }
    const { preview, actions, manuscriptUpdatedAt } = parsed.data;
    return withProjectWriteLock(projectId, async () => {
      const workspace = await getWorkspace(projectId);
      if (workspace.manuscript.updatedAt !== manuscriptUpdatedAt) {
        throw new HTTPException(409, { message: "La structure du manuscrit a changé. Préparez un nouvel aperçu avant de réimporter." });
      }
      const existingUnits = await listUnits(projectId);
      let result;
      try {
        result = applyManuscriptReimport(workspace.manuscript, existingUnits, preview, actions);
      } catch (error) {
        throw new HTTPException(400, {
          message: error instanceof Error ? error.message : "La réimportation ne peut pas être appliquée.",
        });
      }
      if (
        workspace.readings.some(
          (reading) => reading.scope?.kind === "paragraph" && result.replacedUnitIds.includes(reading.scope.unitId)
        )
      ) {
        throw new HTTPException(400, {
          message: "Une section choisie contient déjà une lecture éditoriale : conservez-la ou réimportez-la comme nouvelle section.",
        });
      }

      await replaceUnitsWhileLocked(projectId, result.units);
      try {
        await putWorkspaceWhileLocked(projectId, {
          manuscript: result.manuscript,
          distribution: workspace.distribution,
          profiles: workspace.profiles,
          articulations: workspace.articulations,
        });
      } catch (error) {
        await replaceUnitsWhileLocked(projectId, existingUnits);
        throw error;
      }
      return c.json({ manuscript: result.manuscript, units: result.units, unitIds: result.unitIds });
    });
  });

  return app;
}

async function preparePreview(body: { name: string; content?: string; contentBase64?: string }) {
  if (body.name.toLowerCase().endsWith(".md") && typeof body.content === "string") {
    if (!body.content.trim()) throw new Error("Le manuscrit est vide.");
    return { preview: previewMarkdownManuscript(body.name, body.content), warnings: [] };
  }
  if (body.name.toLowerCase().endsWith(".docx") && typeof body.contentBase64 === "string") {
    let ignoredImages = 0;
    const converted = await mammoth.convertToHtml(
      { buffer: decodeDocx(body.contentBase64) },
      {
        styleMap: ["comment-reference => sup"],
        includeEmbeddedStyleMap: false,
        externalFileAccess: false,
        convertImage: mammoth.images.imgElement(async () => {
          ignoredImages += 1;
          return { src: "" };
        }),
        idPrefix: "auto-essay-docx-",
      }
    );
    return {
      preview: previewDocxHtml(body.name, converted.value),
      warnings: [
        ...converted.messages.map((message) => message.message),
        ...(ignoredImages > 0
          ? [`${ignoredImages} image${ignoredImages > 1 ? "s" : ""} a été ignorée${ignoredImages > 1 ? "s" : ""}.`]
          : []),
      ],
    };
  }
  if (body.name.toLowerCase().endsWith(".odt") && typeof body.contentBase64 === "string") {
    const archive = decodeDocumentArchive(body.contentBase64);
    const entries = readSafeZipEntries(archive, ["mimetype", "content.xml"]);
    if (entries.mimetype.toString("utf8") !== "application/vnd.oasis.opendocument.text") {
      throw new Error("Le fichier LibreOffice est invalide.");
    }
    return previewOdtDocument(body.name, entries["content.xml"].toString("utf8"));
  }
  throw new Error("Choisissez un fichier Markdown (.md), Word (.docx) ou LibreOffice (.odt).");
}

function decodeDocx(contentBase64: string): Buffer {
  const document = decodeDocumentArchive(contentBase64);
  assertSafeZipArchive(document);
  return document;
}

function decodeDocumentArchive(contentBase64: string): Buffer {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(contentBase64)) {
    throw new Error("Le document est invalide.");
  }
  const document = Buffer.from(contentBase64, "base64");
  if (document.length === 0 || document.length > 5_000_000) {
    throw new Error("Le fichier dépasse la taille maximale de 5 Mo.");
  }
  return document;
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

function buildPlannedManuscriptTree(preview: ManuscriptImportPreview): ManuscriptChild[] {
  const roots: ManuscriptChild[] = [];
  const ancestors: Array<{ level: number; node: ManuscriptNode }> = [];

  for (const section of preview.sections) {
    const node = createManuscriptNode({
      id: section.id,
      title: section.title,
      plan: section.content.trim() ? [createPlanEntry(section.content.trim())] : [],
    });
    while (ancestors.at(-1)?.level !== undefined && ancestors.at(-1)!.level >= section.level) {
      ancestors.pop();
    }
    const parent = ancestors.at(-1)?.node;
    if (parent) parent.children.push(node);
    else roots.push(node);
    ancestors.push({ level: section.level, node });
  }

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
