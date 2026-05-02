import { z } from "zod";

/**
 * Niveaux de confiance pour une assertion
 */
export const ConfidenceLevelSchema = z.enum([
  "certain",      // Preuve solide, consensus
  "probable",     // Preuudes indices forts
  "speculative",  // Hypothèse à explorer
  "unsupported",  // Non prouvé, doit être marqué
]);

export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

/**
 * Type d'assertion
 */
export const ClaimTypeSchema = z.enum([
  "fact",           // Fait vérifiable
  "interpretation", // Interprétation d'un fait
  "hypothesis",     // Hypothèse de travail
  "counterclaim",   // Contre-argument
  "synthesis",      // Synthèse de multiples sources
]);

export type ClaimType = z.infer<typeof ClaimTypeSchema>;

/**
 * Portée d'une assertion
 */
export const ClaimScopeSchema = z.enum([
  "paragraph",
  "section",
  "chapter",
  "book",
]);

export type ClaimScope = z.infer<typeof ClaimScopeSchema>;

/**
 * Statut de vérification d'une assertion
 */
export const ClaimStatusSchema = z.enum([
  "pending",     // En attente de vérification
  "verified",    // Vérifiée et validée
  "challenged",  // Contestée, nécessite révision
  "rejected",    // Rejetée, fausse ou non fondée
]);

export type ClaimStatus = z.infer<typeof ClaimStatusSchema>;

/**
 * Assertion (Claim) - Au cœur du système essayistique
 * Chaque affirmation importante du texte est tracée
 */
export const ClaimSchema = z.object({
  /** Identifiant unique */
  id: z.string(),

  /** L'assertion elle-même (phrase déclarative) */
  statement: z.string().min(1),

  /** IDs des sources qui soutiennent cette assertion */
  sourceIds: z.array(z.string()).default([]),

  /** Niveau de confiance */
  confidenceLevel: ConfidenceLevelSchema,

  /** Type d'assertion */
  claimType: ClaimTypeSchema,

  /** Portée (paragraphe, section, etc.) */
  scope: ClaimScopeSchema.default("paragraph"),

  /** ID d'une assertion contradictoire */
  contradictionOf: z.string().optional(),

  /** Statut de vérification */
  status: ClaimStatusSchema.default("pending"),

  /** ID de l'unité de rédaction contenant cette assertion */
  draftUnitId: z.string().optional(),

  /** Projet associé */
  projectId: z.string(),

  /** Position dans le texte (caractères) */
  position: z.object({
    start: z.number(),
    end: z.number(),
  }).optional(),

  /** Notes sur la vérification */
  verificationNotes: z.string().optional(),

  /** Date de création */
  createdAt: z.string().datetime(),

  /** Date de vérification */
  verifiedAt: z.string().datetime().optional(),
});

export type Claim = z.infer<typeof ClaimSchema>;

/**
 * Crée une nouvelle assertion
 */
export function createClaim(
  partial: Omit<Partial<Claim>, "id" | "createdAt"> & {
    projectId: string;
    statement: string;
    confidenceLevel: ConfidenceLevel;
  }
): Claim {
  return ClaimSchema.parse({
    id: crypto.randomUUID(),
    sourceIds: [],
    claimType: "interpretation",
    scope: "paragraph",
    status: "pending",
    createdAt: new Date().toISOString(),
    ...partial,
  });
}

/**
 * Vérifie si une assertion peut être publiée
 * Règle : pas d'assertion "unsupported" en publication
 */
export function isClaimPublishable(claim: Claim): boolean {
  if (claim.confidenceLevel === "unsupported" && claim.status !== "verified") {
    return false;
  }
  return true;
}

/**
 * Liste des mots de forte assertion à détecter (anti-overclaim)
 */
export const STRONG_ASSERTION_WORDS = [
  "démontre",
  "prouve",
  "établit",
  "confirme",
  "vérifie",
  "certifie",
  "affirme définitivement",
  "sans aucun doute",
  "il est certain que",
];

/**
 * Liste des mots de prudence épistémologique
 */
export const PRUDENT_WORDS = [
  "suggère",
  "indique",
  "montre",
  "semble",
  "pourrait",
  "pourrait suggérer",
  "laisse entendre",
  " invite à penser",
  "selon",
];
