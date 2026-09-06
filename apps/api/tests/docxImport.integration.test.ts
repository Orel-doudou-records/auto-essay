import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { makeTempDataDir, makeTestApp, postJson } from "./helper.js";

describe("DOCX manuscript import", () => {
  it("converts a real Word document and keeps its comments as annotations", async () => {
    const document = await readFile(new URL("../../../node_modules/mammoth/test/test-data/comments.docx", import.meta.url));
    const app = makeTestApp(makeTempDataDir());
    const created = await postJson(app, "/api/projects", { title: "Projet Word réel" });
    const { project } = (await created.json()) as { project: { id: string } };

    const previewResponse = await postJson(app, `/api/projects/${project.id}/manuscript-import/preview`, {
      name: "commentaires.docx",
      contentBase64: document.toString("base64"),
    });

    expect(previewResponse.status).toBe(200);
    await expect(previewResponse.json()).resolves.toMatchObject({
      preview: {
        title: "commentaires",
        sections: [
          {
            content: expect.stringContaining("Ouch"),
            annotations: expect.arrayContaining([
              { kind: "comment", content: "A tachyon walks into a bar." },
              { kind: "comment", content: "Fin." },
            ]),
          },
        ],
      },
    });
  });
});
