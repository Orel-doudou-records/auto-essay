import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { inflateRawSync } from "node:zlib";
import {
  createDraftUnit,
  createManuscript,
  createManuscriptLeaf,
  createManuscriptNode,
  previewDocxHtml,
  previewMarkdownManuscript,
  type DraftUnit,
  type ManuscriptChild,
  type ManuscriptImportAnnotation,
  type ManuscriptImportPreview,
  type ManuscriptNode,
} from "@auto-essay/core";
import mammoth from "mammoth";
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
    if (!parsed.success) throw new HTTPException(400, { message: "Le fichier dépasse 5 Mo ou son nom est invalide." });
    const body = parsed.data;
    try {
      if (body.name.toLowerCase().endsWith(".md") && "content" in body) {
        if (!body.content.trim()) throw new Error("Le manuscrit est vide.");
        return c.json({ preview: previewMarkdownManuscript(body.name, body.content), warnings: [] });
      }
      if (body.name.toLowerCase().endsWith(".docx") && "contentBase64" in body) {
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
        return c.json({
          preview: previewDocxHtml(body.name, converted.value),
          warnings: [
            ...converted.messages.map((message) => message.message),
            ...(ignoredImages > 0
              ? [`${ignoredImages} image${ignoredImages > 1 ? "s" : ""} a été ignorée${ignoredImages > 1 ? "s" : ""}.`]
              : []),
          ],
        });
      }
      throw new Error("Choisissez un fichier Markdown (.md) ou Word (.docx).");
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

function decodeDocx(contentBase64: string): Buffer {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(contentBase64)) {
    throw new Error("Le document Word est invalide.");
  }
  const document = Buffer.from(contentBase64, "base64");
  if (document.length === 0 || document.length > 5_000_000) {
    throw new Error("Le fichier dépasse la taille maximale de 5 Mo.");
  }
  assertSafeDocxArchive(document);
  return document;
}

const MAX_DOCX_ENTRIES = 2_000;
const MAX_DOCX_UNCOMPRESSED_BYTES = 25_000_000;

export function assertSafeDocxArchive(document: Buffer): void {
  const endOfCentralDirectory = findEndOfCentralDirectory(document);
  if (endOfCentralDirectory < 0) throw new Error("Le document Word est invalide.");

  const diskNumber = document.readUInt16LE(endOfCentralDirectory + 4);
  const centralDirectoryDisk = document.readUInt16LE(endOfCentralDirectory + 6);
  const entryCount = document.readUInt16LE(endOfCentralDirectory + 10);
  const centralDirectorySize = document.readUInt32LE(endOfCentralDirectory + 12);
  const centralDirectoryOffset = document.readUInt32LE(endOfCentralDirectory + 16);
  if (
    diskNumber !== 0 ||
    centralDirectoryDisk !== 0 ||
    entryCount === 0xffff ||
    centralDirectorySize === 0xffffffff ||
    centralDirectoryOffset === 0xffffffff
  ) {
    throw new Error("Le document Word utilise une archive non prise en charge.");
  }
  if (entryCount > MAX_DOCX_ENTRIES || centralDirectorySize > 1_000_000) {
    throw new Error("Le document Word contient trop de fichiers internes.");
  }

  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
  if (centralDirectoryEnd > endOfCentralDirectory) throw new Error("Le document Word est invalide.");

  let cursor = centralDirectoryOffset;
  let uncompressedBytes = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > centralDirectoryEnd || document.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error("Le document Word est invalide.");
    }
    const compressedSize = document.readUInt32LE(cursor + 20);
    const declaredUncompressedSize = document.readUInt32LE(cursor + 24);
    const fileNameLength = document.readUInt16LE(cursor + 28);
    const extraFieldLength = document.readUInt16LE(cursor + 30);
    const commentLength = document.readUInt16LE(cursor + 32);
    const compressionMethod = document.readUInt16LE(cursor + 10);
    const localHeaderOffset = document.readUInt32LE(cursor + 42);
    if (compressedSize === 0xffffffff || declaredUncompressedSize === 0xffffffff || localHeaderOffset === 0xffffffff) {
      throw new Error("Le document Word utilise une archive non prise en charge.");
    }
    uncompressedBytes += readActualUncompressedSize(
      document,
      centralDirectoryOffset,
      localHeaderOffset,
      compressionMethod,
      compressedSize,
      MAX_DOCX_UNCOMPRESSED_BYTES - uncompressedBytes
    );
    if (uncompressedBytes > MAX_DOCX_UNCOMPRESSED_BYTES) {
      throw new Error("Le document Word est trop volumineux après décompression.");
    }
    cursor += 46 + fileNameLength + extraFieldLength + commentLength;
  }
  if (cursor !== centralDirectoryEnd) throw new Error("Le document Word est invalide.");
}

function readActualUncompressedSize(
  document: Buffer,
  centralDirectoryOffset: number,
  localHeaderOffset: number,
  compressionMethod: number,
  compressedSize: number,
  remainingBytes: number
): number {
  if (localHeaderOffset + 30 > centralDirectoryOffset || document.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
    throw new Error("Le document Word est invalide.");
  }
  const fileNameLength = document.readUInt16LE(localHeaderOffset + 26);
  const extraFieldLength = document.readUInt16LE(localHeaderOffset + 28);
  const contentStart = localHeaderOffset + 30 + fileNameLength + extraFieldLength;
  const contentEnd = contentStart + compressedSize;
  if (contentEnd > centralDirectoryOffset) throw new Error("Le document Word est invalide.");
  if (compressionMethod === 0) return compressedSize;
  if (compressionMethod !== 8) throw new Error("Le document Word utilise une compression non prise en charge.");

  try {
    const content = inflateRawSync(document.subarray(contentStart, contentEnd), {
      maxOutputLength: Math.max(remainingBytes + 1, 1),
    });
    return content.length;
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ERR_BUFFER_TOO_LARGE") {
      throw new Error("Le document Word est trop volumineux après décompression.");
    }
    throw new Error("Le document Word est invalide.");
  }
}

function findEndOfCentralDirectory(document: Buffer): number {
  const firstPossibleOffset = Math.max(0, document.length - 22 - 0xffff);
  for (let offset = document.length - 22; offset >= firstPossibleOffset; offset -= 1) {
    if (
      document.readUInt32LE(offset) === 0x06054b50 &&
      offset + 22 + document.readUInt16LE(offset + 20) === document.length
    ) {
      return offset;
    }
  }
  return -1;
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
