import { z } from "zod";

/**
 * Types de sources supportés par le système essayistique.
 * Le type décrit le support ou l'origine technique, pas le régime de savoir.
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
 * Manière dont une source produit, situe et autorise du savoir.
 * Un même SourceType peut appartenir à plusieurs régimes documentaires.
 */
export const SourceRegimeSchema = z.enum([
  "institutional_archive",
  "testimony",
  "academic_study",
  "artwork",
  "dataset",
  "criticism",
  "personal_memory",
  "promotional_communication",
  "author_interpretation",
  "journalistic_report",
  "legal_document",
  "other",
]);

export type SourceRegime = z.infer<typeof SourceRegimeSchema>;

/**
 * Position située de la source vis-à-vis de son objet.
 * Ce champ ne constitue pas une hiérarchie automatique de crédibilité.
 */
export const SourcePositionSchema = z
  .object({
    role: z
      .enum([
        "primary_witness",
        "participant",
        "institutional_record",
        "researcher",
        "critic",
        "journalist",
        "artist",
        "editor",
        "aggregator",
        "other",
      ])
      .optional(),
    perspective: z.string().min(1).optional(),
    institutionalAffiliation: z.string().min(1).optional(),
    declaredInterests: z.array(z.string().min(1)).default([]),
  })
  .superRefine((position, context) => {
    const hasMeaningfulValue =
      position.role !== undefined ||
      position.perspective !== undefined ||
      position.institutionalAffiliation !== undefined ||
      position.declaredInterests.length > 0;

    if (!hasMeaningfulValue) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A source position must contain at least one situated attribute",
      });
    }
  });

export type SourcePosition = z.infer<typeof SourcePositionSchema>;

/**
 * Statut de vérification d'une source.
 */
export const VerificationStatusSchema = z.enum([
  "unverified",
  "verified",
  "disputed",
  "deprecated",
]);

export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;

/**
 * Annotation sur une source.
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
 * Schéma Zod pour une source.
 * SourceType décrit le support ; regime et position décrivent sa situation
 * documentaire et épistémique lorsqu'elle est connue.
 */
export const SourceSchema = z.object({
  /** Identifiant unique */
  id: z.string(),

  /** Support ou origine technique de la source */
  type: SourceTypeSchema,

  /** Régime documentaire ou épistémique */
  regime: SourceRegimeSchema.optional(),

  /** Position située de la source vis-à-vis de son objet */
  position: SourcePositionSchema.optional(),

  /** Ce que cette source ne permet pas d'établir à elle seule */
  epistemicLimits: z.array(z.string().min(1)).default([]),

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
export type SourceInput = z.input<typeof SourceSchema>;

/**
 * Crée une nouvelle source avec valeurs par défaut.
 */
export function createSource(
  partial: Omit<Partial<SourceInput>, "id"> & {
    projectId: string;
    title: string;
    content: string;
  }
): Source {
  const now = new Date().toISOString();
  return SourceSchema.parse({
    id: crypto.randomUUID(),
    type: "note",
    authors: [],
    annotations: [],
    tags: [],
    epistemicLimits: [],
    verificationStatus: "unverified",
    createdAt: now,
    updatedAt: now,
    ...partial,
  });
}
