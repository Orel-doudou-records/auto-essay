import { describe, expect, it } from "vitest";
import { makeTempDataDir, makeTestApp, postJson } from "./helper.js";

describe("ODT manuscript import", () => {
  it("reads content.xml without LibreOffice and returns its editable preview", async () => {
    const app = makeTestApp(makeTempDataDir());
    const created = await postJson(app, "/api/projects", { title: "Projet ODT" });
    const { project } = (await created.json()) as { project: { id: string } };
    const contentXml =
      '<office:document-content><office:body><office:text><text:h text:outline-level="1">Ouverture</text:h><text:p>Texte avec <text:a xlink:href="https://example.test">un lien</text:a><text:note><text:note-body><text:p>Note à relire.</text:p></text:note-body></text:note>.</text:p></office:text></office:body></office:document-content>';

    const previewResponse = await postJson(app, `/api/projects/${project.id}/manuscript-import/preview`, {
      name: "essai.odt",
      contentBase64: createOdt(contentXml).toString("base64"),
    });

    expect(previewResponse.status).toBe(200);
    await expect(previewResponse.json()).resolves.toMatchObject({
      preview: {
        title: "essai",
        sections: [
          {
            title: "Ouverture",
            content: "Texte avec un lien.",
            annotations: [
              { kind: "link", label: "un lien", url: "https://example.test" },
              { kind: "comment", content: "Note à relire." },
            ],
          },
        ],
      },
      warnings: [],
    });
  });

  it("refuses an archive that is not an ODT Writer document", async () => {
    const app = makeTestApp(makeTempDataDir());
    const created = await postJson(app, "/api/projects", { title: "Projet ODT" });
    const { project } = (await created.json()) as { project: { id: string } };

    const previewResponse = await postJson(app, `/api/projects/${project.id}/manuscript-import/preview`, {
      name: "essai.odt",
      contentBase64: createOdt("<office:document-content/>", "application/zip").toString("base64"),
    });

    expect(previewResponse.status).toBe(400);
    await expect(previewResponse.json()).resolves.toMatchObject({ message: "Le fichier LibreOffice est invalide." });
  });

  it("refuses an archive with two content.xml entries", async () => {
    const app = makeTestApp(makeTempDataDir());
    const created = await postJson(app, "/api/projects", { title: "Projet ODT" });
    const { project } = (await created.json()) as { project: { id: string } };

    const previewResponse = await postJson(app, `/api/projects/${project.id}/manuscript-import/preview`, {
      name: "essai.odt",
      contentBase64: createOdt("<office:document-content/>", undefined, true).toString("base64"),
    });

    expect(previewResponse.status).toBe(400);
    await expect(previewResponse.json()).resolves.toMatchObject({ message: "L’archive contient plusieurs entrées content.xml." });
  });
});

function createOdt(contentXml: string, mimetype = "application/vnd.oasis.opendocument.text", duplicateContent = false): Buffer {
  const entries = [
    { name: "mimetype", content: Buffer.from(mimetype) },
    { name: "content.xml", content: Buffer.from(contentXml) },
    ...(duplicateContent ? [{ name: "content.xml", content: Buffer.from("<office:document-content/>") }] : []),
  ];
  let offset = 0;
  const localFiles = entries.map(({ name, content }) => {
    const fileName = Buffer.from(name);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt32LE(content.length, 18);
    header.writeUInt32LE(content.length, 22);
    header.writeUInt16LE(fileName.length, 26);
    const localFile = Buffer.concat([header, fileName, content]);
    const result = { name: fileName, content, offset };
    offset += localFile.length;
    return { localFile, ...result };
  });
  const localDirectory = Buffer.concat(localFiles.map(({ localFile }) => localFile));
  const centralDirectory = Buffer.concat(
    localFiles.map(({ name, content, offset: localHeaderOffset }) => {
      const header = Buffer.alloc(46);
      header.writeUInt32LE(0x02014b50, 0);
      header.writeUInt32LE(content.length, 20);
      header.writeUInt32LE(content.length, 24);
      header.writeUInt16LE(name.length, 28);
      header.writeUInt32LE(localHeaderOffset, 42);
      return Buffer.concat([header, name]);
    })
  );
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(entries.length, 8);
  endOfCentralDirectory.writeUInt16LE(entries.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(localDirectory.length, 16);
  return Buffer.concat([localDirectory, centralDirectory, endOfCentralDirectory]);
}
