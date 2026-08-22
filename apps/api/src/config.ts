import path from "node:path";
import os from "node:os";

export function getDataDir(): string {
  return process.env.AUTO_ESSAY_DATA_DIR ?? path.join(os.homedir(), ".auto-essay");
}
