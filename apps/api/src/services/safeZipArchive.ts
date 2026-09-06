import { inflateRawSync } from "node:zlib";

const MAX_ARCHIVE_ENTRIES = 2_000;
const MAX_UNCOMPRESSED_ARCHIVE_BYTES = 25_000_000;

export function assertSafeZipArchive(archive: Buffer): void {
  inspectZipArchive(archive);
}

export function readSafeZipEntry(archive: Buffer, expectedName: string): Buffer {
  return readSafeZipEntries(archive, [expectedName])[expectedName];
}

export function readSafeZipEntries(archive: Buffer, expectedNames: readonly string[]): Record<string, Buffer> {
  const expected = new Set(expectedNames);
  const entries = new Map<string, Buffer>();
  inspectZipArchive(archive, (name, content) => {
    if (!expected.has(name)) return;
    if (entries.has(name)) throw new Error(`L’archive contient plusieurs entrées ${name}.`);
    entries.set(name, content);
  });
  return Object.fromEntries(expectedNames.map((name) => {
    const entry = entries.get(name);
    if (!entry) throw new Error(`L’archive ne contient pas ${name}.`);
    return [name, entry];
  }));
}

function inspectZipArchive(archive: Buffer, onEntry?: (name: string, content: Buffer) => void): void {
  const endOfCentralDirectory = findEndOfCentralDirectory(archive);
  if (endOfCentralDirectory < 0) throw new Error("Le document est invalide.");

  const diskNumber = archive.readUInt16LE(endOfCentralDirectory + 4);
  const centralDirectoryDisk = archive.readUInt16LE(endOfCentralDirectory + 6);
  const entryCount = archive.readUInt16LE(endOfCentralDirectory + 10);
  const centralDirectorySize = archive.readUInt32LE(endOfCentralDirectory + 12);
  const centralDirectoryOffset = archive.readUInt32LE(endOfCentralDirectory + 16);
  if (
    diskNumber !== 0 ||
    centralDirectoryDisk !== 0 ||
    entryCount === 0xffff ||
    centralDirectorySize === 0xffffffff ||
    centralDirectoryOffset === 0xffffffff
  ) {
    throw new Error("Le document utilise une archive non prise en charge.");
  }
  if (entryCount > MAX_ARCHIVE_ENTRIES || centralDirectorySize > 1_000_000) {
    throw new Error("Le document contient trop de fichiers internes.");
  }

  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
  if (centralDirectoryEnd > endOfCentralDirectory) throw new Error("Le document est invalide.");

  let cursor = centralDirectoryOffset;
  let uncompressedBytes = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > centralDirectoryEnd || archive.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error("Le document est invalide.");
    }
    const compressedSize = archive.readUInt32LE(cursor + 20);
    const declaredUncompressedSize = archive.readUInt32LE(cursor + 24);
    const fileNameLength = archive.readUInt16LE(cursor + 28);
    const extraFieldLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    const compressionMethod = archive.readUInt16LE(cursor + 10);
    const localHeaderOffset = archive.readUInt32LE(cursor + 42);
    const fileNameStart = cursor + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    if (
      compressedSize === 0xffffffff ||
      declaredUncompressedSize === 0xffffffff ||
      localHeaderOffset === 0xffffffff ||
      fileNameEnd > centralDirectoryEnd
    ) {
      throw new Error("Le document utilise une archive non prise en charge.");
    }
    const content = readEntryContent(
      archive,
      centralDirectoryOffset,
      localHeaderOffset,
      compressionMethod,
      compressedSize,
      MAX_UNCOMPRESSED_ARCHIVE_BYTES - uncompressedBytes
    );
    uncompressedBytes += content.length;
    if (uncompressedBytes > MAX_UNCOMPRESSED_ARCHIVE_BYTES) {
      throw new Error("Le document est trop volumineux après décompression.");
    }
    onEntry?.(archive.subarray(fileNameStart, fileNameEnd).toString("utf8"), content);
    cursor += 46 + fileNameLength + extraFieldLength + commentLength;
  }
  if (cursor !== centralDirectoryEnd) throw new Error("Le document est invalide.");
}

function readEntryContent(
  archive: Buffer,
  centralDirectoryOffset: number,
  localHeaderOffset: number,
  compressionMethod: number,
  compressedSize: number,
  remainingBytes: number
): Buffer {
  if (localHeaderOffset + 30 > centralDirectoryOffset || archive.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
    throw new Error("Le document est invalide.");
  }
  const fileNameLength = archive.readUInt16LE(localHeaderOffset + 26);
  const extraFieldLength = archive.readUInt16LE(localHeaderOffset + 28);
  const contentStart = localHeaderOffset + 30 + fileNameLength + extraFieldLength;
  const contentEnd = contentStart + compressedSize;
  if (contentEnd > centralDirectoryOffset) throw new Error("Le document est invalide.");
  if (compressionMethod === 0) return archive.subarray(contentStart, contentEnd);
  if (compressionMethod !== 8) throw new Error("Le document utilise une compression non prise en charge.");

  try {
    return inflateRawSync(archive.subarray(contentStart, contentEnd), {
      maxOutputLength: Math.max(remainingBytes + 1, 1),
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ERR_BUFFER_TOO_LARGE") {
      throw new Error("Le document est trop volumineux après décompression.");
    }
    throw new Error("Le document est invalide.");
  }
}

function findEndOfCentralDirectory(archive: Buffer): number {
  const firstPossibleOffset = Math.max(0, archive.length - 22 - 0xffff);
  for (let offset = archive.length - 22; offset >= firstPossibleOffset; offset -= 1) {
    if (
      archive.readUInt32LE(offset) === 0x06054b50 &&
      offset + 22 + archive.readUInt16LE(offset + 20) === archive.length
    ) {
      return offset;
    }
  }
  return -1;
}
