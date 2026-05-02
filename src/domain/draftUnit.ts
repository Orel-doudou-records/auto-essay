import { z } from "zod";

/**
 * Granularité d'une unité de rédaction
 */
export const GranularitySchema = z.enum([
  "paragraph",  // 120-250 mots
  "section",    // 800-2000 mots
  "chapter",    // 3000-8000 mots
  "book",       // 20000+ mots
]);

export type Granularity = z.infer<typeof GranularitySchema>;

/**
 * Statut d'une unité de rédaction
 */
export const DraftUnitStatusSchema = z.enum([
  "drafting",    // En cours de rédaction
  "reviewing",   // En révision
  "revising",    // En cours de modification selon brief
  "verified",    // Vérifiée, prête pour publication
  "published",   // Publiée dans le registry
  "archived",    // Archivée, remplacée
]);

export type DraftUnitStatus = z.infer<typeof DraftUnitStatusSchema>;

/**
 * Pack de preuves pour rédiger une unité
 */
export const EvidencePackSchema = z.object({
  /** Sources sélectionnées pour cette unité */
  sourceIds: z.array(z.string()),

  /** Citations clés à intégrer */
  keyCitations: z.array(z.object({
    sourceId: z.string(),
    quote: z.string(),
    pageRange: z.string().optional(),
    context: z.string().optional(),
  })).default([]),

  /** Claims déjà établies sur lesquelles s'appuyer */
  supportingClaimIds: z.array(z.string()).default([]),

  /** Objections à traiter */
  objections: z.array(z.object({
    statement: z.string(),
    sourceId: z.string().optional(),
    responseStrategy: z.string().optional(),
  })).default([]),

  /** Notes de l'auteur */
  authorNotes: z.string().optional(),
});

export type EvidencePack = z.infer<typeof EvidencePackSchema>;

/**
 * Unité de rédaction - Le cœur du travail d'écriture
 * Granularité réglable : paragraphe, section, chapitre, livre
 */
export const DraftUnitSchema = z.object({
  /** Identifiant unique */
  id: z.string(),

  /** Projet parent */
  projectId: z.string(),

  /** Granularité */
  granularity: GranularitySchema,

  /** Objectif de nombre de mots */
  targetWordCount: z.number().int().positive(),

  /** Thèse/argument principal de cette unité */
  thesis: z.string().optional(),

  /** Contexte dans le plan global */
  contextInPlan: z.object({
    section: z.string(),
    precedingUnits: z.array(z.string()).optional(),
    followingUnits: z.array(z.string()).optional(),
  }).optional(),

  /** Pack de preuves */
  evidencePack: EvidencePackSchema,

  /** Contenu rédigé */
  content: z.string().default(""),

  /** IDs des assertions contenues */
  claimIds: z.array(z.string()).default([]),

  /** Statut actuel */
  status: DraftUnitStatusSchema.default("drafting"),

  /** Version (incrémentée à chaque révision majeure) */
  version: z.number().int().nonnegative().default(1),

  /** Scores d'évaluation */
  scores: z.object({
    overall: z.number().min(0).max(10).optional(),
    claimSupport: z.number().min(0).max(10).optional(),
    citationIntegrity: z.number().min(0).max(10).optional(),
    counterargumentQuality: z.number().min(0).max(10).optional(),
    transitionClarity: z.number().min(0).max(10).optional(),
    scopeControl: z.number().min(0).max(10).optional(),
    voiceConsistency: z.number().min(0).max(10).optional(),
  }).optional(),

  /** ID du brief de révision en cours */
  activeRevisionBriefId: z.string().optional(),

  /** Date de création */
  createdAt: z.string().datetime(),

  /** Date de dernière modification */
  updatedAt: z.string().datetime(),

  /** Date de publication */
  publishedAt: z.string().datetime().optional(),
});

export type DraftUnit = z.infer<typeof DraftUnitSchema>;

/**
 * Word count par défaut selon la granularité
 */
export const DEFAULT_WORD_COUNTS: Record<Granularity, number> = {
  paragraph: 200,
  section: 1200,
  chapter: 5000,
  book: 50000,
};

/**
 * Crée une nouvelle unité de rédaction
 */
export function createDraftUnit(
  partial: Omit<Partial<DraftUnit>, "id" | "createdAt" | "updatedAt"> & {
    projectId: string;
    granularity: Granularity;
  }
): DraftUnit {
  const now = new Date().toISOString();
  const granularity = partial.granularity;
  const targetWordCount = partial.targetWordCount ?? DEFAULT_WORD_COUNTS[granularity];

  return DraftUnitSchema.parse({
    id: crypto.randomUUID(),
    targetWordCount,
    evidencePack: { sourceIds: [] },
    content: "",
    claimIds: [],
    status: "drafting",
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...partial,
  });
}

/**
 * Compte les mots dans le contenu
 */
export function countWords(content: string): number {
  return content.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Vérifie si une unité atteint son objectif de mots
 */
export function meetsWordCountTarget(unit: DraftUnit): boolean {
  const currentCount = countWords(unit.content);
  // Tolérance de ±20%
  const min = unit.targetWordCount * 0.8;
  const max = unit.targetWordCount * 1.2;
  return currentCount >= min && currentCount <= max;
}
