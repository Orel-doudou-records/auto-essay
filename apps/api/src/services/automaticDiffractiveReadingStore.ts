import fs from "node:fs/promises";
import path from "node:path";
import {
  AutomaticDiffractiveReadingSchema,
  type AutomaticDiffractiveReading,
} from "@auto-essay/core";
import { z } from "zod";
import { getDataDir } from "../config.js";

const AutomaticDiffractiveReadingsFileSchema = z.object({
  readings: z.array(AutomaticDiffractiveReadingSchema),
});

type AutomaticDiffractiveReadingsFile = z.infer<
  typeof AutomaticDiffractiveReadingsFileSchema
>;

export async function listAutomaticDiffractiveReadings(
  projectId: string,
  sectionId?: string
): Promise<AutomaticDiffractiveReading[]> {
  const readings = (await readAutomaticDiffractiveReadings(projectId)).readings;
  return sectionId ? readings.filter((reading) => reading.sectionId === sectionId) : readings;
}

export async function getAutomaticDiffractiveReading(
  projectId: string,
  readingId: string
): Promise<AutomaticDiffractiveReading | undefined> {
  return (await listAutomaticDiffractiveReadings(projectId)).find((reading) => reading.id === readingId);
}

export async function storeAutomaticDiffractiveReading(
  projectId: string,
  reading: AutomaticDiffractiveReading
): Promise<AutomaticDiffractiveReading> {
  if (reading.projectId !== projectId) {
    throw new Error("automatic reading project does not match storage project");
  }
  const data = await readAutomaticDiffractiveReadings(projectId);
  data.readings.push(AutomaticDiffractiveReadingSchema.parse(reading));
  await writeAutomaticDiffractiveReadings(projectId, data);
  return reading;
}

export async function updateAutomaticDiffractiveReading(
  projectId: string,
  readingId: string,
  update: (reading: AutomaticDiffractiveReading) => AutomaticDiffractiveReading
): Promise<AutomaticDiffractiveReading | undefined> {
  const data = await readAutomaticDiffractiveReadings(projectId);
  const index = data.readings.findIndex((reading) => reading.id === readingId);
  if (index < 0) return undefined;

  const next = AutomaticDiffractiveReadingSchema.parse(update(data.readings[index]));
  data.readings[index] = next;
  await writeAutomaticDiffractiveReadings(projectId, data);
  return next;
}

async function readAutomaticDiffractiveReadings(
  projectId: string
): Promise<AutomaticDiffractiveReadingsFile> {
  try {
    const raw = await fs.readFile(automaticDiffractiveReadingsPath(projectId), "utf-8");
    return AutomaticDiffractiveReadingsFileSchema.parse(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { readings: [] };
    }
    throw error;
  }
}

async function writeAutomaticDiffractiveReadings(
  projectId: string,
  data: AutomaticDiffractiveReadingsFile
): Promise<void> {
  const directory = path.join(getDataDir(), projectId);
  await fs.mkdir(directory, { recursive: true });
  const target = automaticDiffractiveReadingsPath(projectId);
  const temporary = `${target}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(data, null, 2));
  await fs.rename(temporary, target);
}

function automaticDiffractiveReadingsPath(projectId: string): string {
  return path.join(getDataDir(), projectId, "automatic-diffractive-readings.json");
}
