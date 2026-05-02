import { z } from "zod";

/**
 * Types de sources supportés par le système essayistique
 */
export const SourceTypeSchema = z.enum([
  "zotero",
  "pdf",
  "markdown",
  "note",
  "book",
  "article",
  "web",
]);

export type SourceType = z.infer<typeof SourceTypeSchema>;

/**
 * Statut de vérification d'une source
 */
export const VerificationStatusSchema = z.enum([
  "unverified",
  "verified",
  "disputed",
  "deprecated",
]);

export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;

/**
 * Annotation sur une source
 */
export const AnnotationSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  content: z.string(),
  pageRange: z.string().optional(),
  highlight: z.string().optional(),
  note: z.string().optional(),
  tags: z.array(z.string()).default([]),
  createdAt: z.string().datetime().optional(),
});

export type Annotation = z.infer<typeof AnnotationSchema>;

/**
 * Schéma Zod pour une source
 * Remplace Fragment pour l'essai - unité de preuve/document
 */
export const SourceSchema = z.object({
  /** Identifiant unique */
  id: z.string(),

  /** Type de source */
  type: SourceTypeSchema,

  /** Titre de l'œuvre/document */
  title: z.string(),

  /** Auteurs */
  authors: z.array(z.string()).default([]),

  /** Contenu extrait ou résumé */
  content: z.string(),

  /** DOI si disponible */
  doi: z.string().optional(),

  /** URL si disponible */
  url: z.string().url().optional(),

  /** Plage de pages pertinente */
  pageRange: z.string().optional(),

  /** Date de publication */
  publicationDate: z.string().optional(),

  /** Éditeur/revue */
  publisher: z.string().optional(),

  /** Annotations associées */
  annotations: z.array(AnnotationSchema).default([]),

  /** Score de crédibilité (0-10) */
  credibilityScore: z.number().min(0).max(10).optional(),

  /** Statut de vérification */
  verificationStatus: VerificationStatusSchema.default("unverified"),

  /** Mots-clés/tags */
  tags: z.array(z.string()).default([]),

  /** Projet associé */
  projectId: z.string(),

  /** Date d'ajout */
  createdAt: z.string().datetime().optional(),

  /** Date de modification */
  updatedAt: z.string().datetime().optional(),
});

export type Source = z.infer<typeof SourceSchema>;

/**
 * Crée une nouvelle source avec valeurs par défaut
 */
export function createSource(
  partial: Omit<Partial<Source>, "id"> & { projectId: string; title: string; content: string }
): Source {
  const now = new Date().toISOString();
  return SourceSchema.parse({
    id: crypto.randomUUID(),
    type: "note",
    authors: [],
    annotations: [],
    tags: [],
    verificationStatus: "unverified",
    createdAt: now,
    updatedAt: now,
    ...partial,
  });
}
