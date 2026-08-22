import fs from "node:fs/promises";
import path from "node:path";
import { getDataDir } from "../config.js";
import { createDraftUnit, DraftUnitSchema, type DraftUnit } from "@auto-essay/core";
import { z } from "zod";

const UnitsFileSchema = z.object({
  units: z.array(DraftUnitSchema),
});

export async function listUnits(projectId: string): Promise<DraftUnit[]> {
  const data = await readUnitsFile(projectId);
  return data.units;
}

export async function getUnit(projectId: string, unitId: string): Promise<DraftUnit | undefined> {
  const units = await listUnits(projectId);
  return units.find((u) => u.id === unitId);
}

export async function createUnit(
  projectId: string,
  draft: Omit<Partial<DraftUnit>, "id" | "createdAt" | "updatedAt" | "version" | "targetWordCount"> & {
    granularity: DraftUnit["granularity"];
    targetWordCount?: number;
  }
): Promise<DraftUnit> {
  const units = await listUnits(projectId);
  const args = { ...draft, projectId } as Parameters<typeof createDraftUnit>[0];
  if (args.targetWordCount === undefined) {
    delete args.targetWordCount;
  }
  const unit = createDraftUnit(args);
  units.push(unit);
  await setUnits(projectId, units);
  return unit;
}

export async function updateUnit(
  projectId: string,
  unitId: string,
  patch: Partial<Pick<DraftUnit, "content" | "status" | "targetWordCount" | "thesis" | "contextInPlan" | "evidencePack" | "version">>
): Promise<DraftUnit | undefined> {
  const units = await listUnits(projectId);
  const idx = units.findIndex((u) => u.id === unitId);
  if (idx < 0) return undefined;
  const updated = {
    ...units[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  units[idx] = DraftUnitSchema.parse(updated);
  await setUnits(projectId, units);
  return units[idx];
}

export async function bumpUnitVersion(
  projectId: string,
  unitId: string,
  newContent: string
): Promise<DraftUnit | undefined> {
  const unit = await getUnit(projectId, unitId);
  if (!unit) return undefined;
  return updateUnit(projectId, unitId, {
    content: newContent,
    version: unit.version + 1,
  });
}

export async function deleteUnit(projectId: string, unitId: string): Promise<boolean> {
  const units = await listUnits(projectId);
  const next = units.filter((u) => u.id !== unitId);
  if (next.length === units.length) return false;
  await setUnits(projectId, next);
  return true;
}

export async function setUnits(projectId: string, units: DraftUnit[]): Promise<void> {
  await writeUnitsFile(projectId, { units });
}

async function readUnitsFile(projectId: string): Promise<z.infer<typeof UnitsFileSchema>> {
  const filePath = unitsPath(projectId);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return UnitsFileSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { units: [] };
    }
    throw err;
  }
}

async function writeUnitsFile(projectId: string, data: z.infer<typeof UnitsFileSchema>): Promise<void> {
  const dir = path.join(getDataDir(), projectId);
  await fs.mkdir(dir, { recursive: true });
  const filePath = unitsPath(projectId);
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2));
  await fs.rename(tmpPath, filePath);
}

function unitsPath(projectId: string): string {
  return path.join(getDataDir(), projectId, "units.json");
}
