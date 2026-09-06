import { readFile } from "node:fs/promises";
import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { assertSafeDocxArchive } from "../src/routes/manuscriptImport.js";

describe("assertSafeDocxArchive", () => {
  it("accepts a normal Word archive", async () => {
    const document = await readFile(new URL("../../../node_modules/mammoth/test/test-data/comments.docx", import.meta.url));
    expect(() => assertSafeDocxArchive(document)).not.toThrow();
  });

  it("accepts a small archive", () => {
    expect(() => assertSafeDocxArchive(createZip([Buffer.alloc(1_000)]))).not.toThrow();
  });

  it("rejects archives with too many internal files", () => {
    const archive = createZip(Array.from({ length: 2_001 }, () => Buffer.alloc(0)));
    expect(() => assertSafeDocxArchive(archive)).toThrow(
      "Le document Word contient trop de fichiers internes."
    );
  });

  it("uses the decompressed bytes instead of the ZIP metadata", () => {
    const compressed = deflateRawSync(Buffer.alloc(25_000_001));
    expect(() => assertSafeDocxArchive(createZip([{ content: compressed, method: 8, declaredSize: 1 }]))).toThrow(
      "Le document Word est trop volumineux après décompression."
    );
  });
});

function createZip(
  entries: Array<Buffer | { content: Buffer; method: 8; declaredSize: number }>
): Buffer {
  const localFiles = entries.map((entry) => {
    const { content, method, declaredSize } = Buffer.isBuffer(entry)
      ? { content: entry, method: 0, declaredSize: entry.length }
      : entry;
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt32LE(content.length, 18);
    localHeader.writeUInt32LE(declaredSize, 22);
    return { content, method, declaredSize, localHeader };
  });
  const localDirectory = Buffer.concat(localFiles.flatMap(({ localHeader, content }) => [localHeader, content]));
  let localHeaderOffset = 0;
  const centralDirectory = Buffer.concat(
    localFiles.map(({ content, method, declaredSize, localHeader }) => {
      const header = Buffer.alloc(46);
      header.writeUInt32LE(0x02014b50, 0);
      header.writeUInt16LE(method, 10);
      header.writeUInt32LE(content.length, 20);
      header.writeUInt32LE(declaredSize, 24);
      header.writeUInt32LE(localHeaderOffset, 42);
      localHeaderOffset += localHeader.length + content.length;
      return header;
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
import { readFile } from "node:fs/promises";
