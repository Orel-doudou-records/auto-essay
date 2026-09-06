import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const optionDefinitions = {
  bib: { type: "string" },
  library: { type: "string" },
  out: { type: "string" },
  batch: { type: "string" },
  fragments: { type: "string" },
  "book-file": { type: "string" },
  concepts: { type: "string" },
  tensions: { type: "string" },
  "book-parts": { type: "string" },
  cuts: { type: "string" },
  "book-plan": { type: "string" },
  plan: { type: "string" },
  entry: { type: "string" },
} as const;

export function loadEnvironmentFile(): void {
  try {
    process.loadEnvFile();
  } catch {
    // Sans .env, on utilise l'environnement existant.
  }
}

export function readOptions(argv: string[]): Partial<Record<keyof typeof optionDefinitions, string>> {
  return parseArgs({ args: argv, options: optionDefinitions }).values;
}

export function readJson(path: string | undefined): unknown {
  return path ? JSON.parse(readFileSync(path, "utf8")) : undefined;
}

export function writeJson(output: unknown, path?: string): void {
  const serialized = JSON.stringify(output, null, 2);
  if (path) {
    writeFileSync(path, serialized);
    return;
  }
  process.stdout.write(`${serialized}\n`);
}

export function reportCliError(error: unknown): void {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
}

export function writeCliWarning(message: string): void {
  process.stderr.write(`${message}\n`);
}

export function writeCliMessage(message: string): void {
  process.stdout.write(`${message}\n`);
}

export function runCli(main: () => Promise<void>): void {
  void main().catch((error: unknown) => {
    reportCliError(error);
    process.exitCode = 1;
  });
}
