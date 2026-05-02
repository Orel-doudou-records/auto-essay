import { z } from "zod";
import type { Source } from "./source";
import type { Claim } from "./claim";
import type { DraftUnit } from "./draftUnit";

/**
 * Carte argumentative - Structure du raisonnement
 */
export const ArgumentMapSchema = z.object({
  /** Question centrale */
  centralQuestion: z.string(),

  /** Thèse principale */
  thesis: z.string(),

  /** Chapitres/sections principales */
  sections: z.array(z.object({
    id: z.string(),
    title: z.string(),
    promise: z.string(),
    keyClaims: z.array(z.string()),
    evidenceNeeded: z.array(z.string()),
    potentialObjections: z.array(z.string()),
  })).default([]),

  /** Transitions principales */
  transitions: z.array(z.object({
    from: z.string(),
    to: z.string(),
    logic: z.string(),
  })).default([]),

  /** Dettes documentaires (sources manquantes) */
  evidenceDebts: z.array(z.object({
    claim: z.string(),
    reason: z.string(),
    priority: z.enum(["high", "medium", "low"]),
  })).default([]),
});

export type ArgumentMap = z.infer<typeof ArgumentMapSchema>;

/**
 * Configuration de voix essayistique
 */
export const EssayVoiceSchema = z.object({
  /** Ton général */
  tone: z.enum(["academic", "journalistic", "literary", "personal", "polemical"]),

  /** Niveau de densité */
  density: z.enum(["light", "moderate", "dense", "technical"]),

  /** Personne (1ère, 3ème) */
  person: z.enum(["first", "third"]),

  /** Usage du passif */
  passiveVoice: z.enum(["avoid", "minimal", "acceptable", "preferred"]),

  /** Pacte au lecteur */
  readerPromise: z.string(),

  /** Écoles/références stylistiques */
  stylisticReferences: z.array(z.string()).optional(),

  /** Contraintes spécifiques */
  constraints: z.array(z.string()).optional(),
});

export type EssayVoice = z.infer<typeof EssayVoiceSchema>;

/**
 * Projet essayistique - Conteneur principal
 */
export const EssayProjectSchema = z.object({
  /** Identifiant unique */
  id: z.string(),

  /** Titre du projet */
  title: z.string(),

  /** Graine de thèse (hypothèse initiale) */
  thesisSeed: z.string(),

  /** Contexte et périmètre */
  contextScope: z.string(),

  /** Période/champ couvert */
  periodOrField: z.string().optional(),

  /** Carte argumentative */
  argumentMap: ArgumentMapSchema.optional(),

  /** Assertions du projet */
  claims: z.array(z.string()).default([]),

  /** IDs des sources */
  sourceIds: z.array(z.string()).default([]),

  /** IDs des unités de rédaction */
  draftUnitIds: z.array(z.string()).default([]),

  /** Configuration de voix */
  voiceConfig: EssayVoiceSchema.optional(),

  /** Date de création */
  createdAt: z.string().datetime(),

  /** Date de modification */
  updatedAt: z.string().datetime(),
});

export type EssayProject = z.infer<typeof EssayProjectSchema>;

/**
 * Crée un nouveau projet essayistique
 */
export function createEssayProject(
  partial: Omit<Partial<EssayProject>, "id" | "createdAt" | "updatedAt"> & {
    title: string;
  }
): EssayProject {
  const now = new Date().toISOString();
  return EssayProjectSchema.parse({
    id: crypto.randomUUID(),
    thesisSeed: "",
    contextScope: "",
    claims: [],
    sourceIds: [],
    draftUnitIds: [],
    createdAt: now,
    updatedAt: now,
    ...partial,
  });
}

/**
 * Snapshot d'un projet pour historique
 */
export interface ProjectSnapshot {
  projectId: string;
  title: string;
  thesisSeed: string;
  argumentMap?: ArgumentMap;
  sourceCount: number;
  claimCount: number;
  draftUnitCount: number;
  timestamp: string;
}

/**
 * Crée un snapshot du projet
 */
export function snapshotProject(
  project: EssayProject,
  sources: Source[],
  claims: Claim[],
  draftUnits: DraftUnit[]
): ProjectSnapshot {
  return {
    projectId: project.id,
    title: project.title,
    thesisSeed: project.thesisSeed,
    argumentMap: project.argumentMap,
    sourceCount: sources.length,
    claimCount: claims.length,
    draftUnitCount: draftUnits.length,
    timestamp: new Date().toISOString(),
  };
}
