import { z } from "zod";

/**
 * Verdict forcé issu d'une lecture diffractive (méthode Haraway/Barad,
 * opérationnalisée par abehmiel/diffract). Pas de « ça dépend » :
 * une coupe éditoriale est toujours nommée.
 *
 * Correspondance canonique (abehmiel/diffract) → domaine :
 *   adopt now        → integrate_now
 *   adopt differently→ adapt_differently
 *   watch            → incubate
 *   pass             → discard
 *   (extension domaine) → archive : garder comme trace, sans exécuter.
 * Le « comment / déclencheur / pourquoi » canonique vit dans `verdictDetail`.
 */
export const VerdictSchema = z.enum([
  "integrate_now",
  "adapt_differently",
  "incubate",
  "archive",
  "discard",
]);

export type Verdict = z.infer<typeof VerdictSchema>;

/**
 * Le fragment diffracté : la position (intuition / claim en formation)
 * mise en regard de ses sources. Pas un nouvel objet canonique :
 * il référence des claims et sources existants.
 */
export const DiffractiveFragmentSchema = z.object({
  statement: z.string().min(1),
  claimIds: z.array(z.string().min(1)).default([]),
  sourceIds: z.array(z.string().min(1)).default([]),
});

export type DiffractiveFragment = z.infer<typeof DiffractiveFragmentSchema>;
export type DiffractiveFragmentInput = z.input<
  typeof DiffractiveFragmentSchema
>;

/**
 * Pass 1 — le fragment à travers le livre : ce qu'il devient posé ici.
 * Une liste vide signifie explicitement « pas de réfraction non-évidente ».
 */
export const Pass1Schema = z.object({
  refraction: z.array(z.string().min(1)).default([]),
});

export type Pass1 = z.infer<typeof Pass1Schema>;

/**
 * Un default révélé comme un choix, avec sa coupe antérieure.
 * `priorCut` peut rester absent quand la coupe est introuvable
 * (marquée « unknown cut: » côté opérateur).
 */
export const RevealedDefaultSchema = z.object({
  default: z.string().min(1),
  priorCut: z.string().min(1).optional(),
});

export type RevealedDefault = z.infer<typeof RevealedDefaultSchema>;

/**
 * Pass 2 — le livre à travers le fragment : motifs latents nommés,
 * defaults révélés comme des choix.
 */
export const Pass2Schema = z.object({
  namedPatterns: z.array(z.string().min(1)).default([]),
  revealedDefaults: z.array(RevealedDefaultSchema).default([]),
});

export type Pass2 = z.infer<typeof Pass2Schema>;

/**
 * Un enchevêtrement : un lieu où fragment et livre sont déjà intra-agissants,
 * indépendamment de toute adoption.
 */
export const EntanglementSchema = z.object({
  name: z.string().min(1),
  cutIfIntegrated: z.string().min(1),
  becomesIntelligible: z.array(z.string().min(1)).default([]),
  becomesUnintelligible: z.array(z.string().min(1)).default([]),
});

export type Entanglement = z.infer<typeof EntanglementSchema>;

/**
 * Pass 3 — les enchevêtrements. Visé à 2–4, mais vide si rien d'honnête
 * (résister à l'insight synthétique prime sur remplir la grille).
 */
export const Pass3Schema = z.object({
  entanglements: z.array(EntanglementSchema).max(4).default([]),
});

export type Pass3 = z.infer<typeof Pass3Schema>;

/**
 * Pass 4 — la coupe agentielle : ce que la décision inclut et exclut,
 * et ce que la NON-décision exclut aussi. Les frontières sont édictées,
 * pas trouvées.
 */
export const DiffractiveCutSchema = z.object({
  cut: z.string().min(1),
  included: z.array(z.string().min(1)).default([]),
  excluded: z.array(z.string().min(1)).default([]),
  cutOfNonAdoption: z.array(z.string().min(1)).default([]),
});

export type DiffractiveCut = z.infer<typeof DiffractiveCutSchema>;
export type DiffractiveCutInput = z.input<typeof DiffractiveCutSchema>;

export type Pass4 = DiffractiveCut;

/**
 * Une ligne de la matrice de compromis (canonique : « implementation tradeoff
 * matrix »). Adaptée au manuscrit : coût d'intégration, réversibilité de la
 * coupe, levier argumentatif, taxe de distraction, et verdict honnête pour
 * CE chemin. Le chemin doit être l'un des 3–5 envisagés (dont « ne rien
 * changer » et « intégrer autrement »).
 */
export const TradeoffSchema = z.object({
  path: z.string().min(1),
  effort: z.string().min(1),
  reversibility: z.string().min(1),
  leverage: z.string().min(1),
  distractionTax: z.string().min(1),
  verdict: VerdictSchema,
});

export type Tradeoff = z.infer<typeof TradeoffSchema>;

/**
 * Lecture diffractive complète : la trace de raisonnement qui motive une
 * articulation. Jamais exécutable — c'est une matière que l'auteur valide
 * ensuite en EditorialDecision.
 */
export const DiffractiveReadingSchema = z.object({
  id: z.string(),
  fragment: DiffractiveFragmentSchema,
  pass1: Pass1Schema,
  pass2: Pass2Schema,
  pass3: Pass3Schema,
  pass4: DiffractiveCutSchema,
  verdict: VerdictSchema,
  /** Le « comment / déclencheur / pourquoi » du verdict (≤ 15 mots). */
  verdictDetail: z.string().min(1),
  action: z.string().min(1),
  tradeoffs: z.array(TradeoffSchema).default([]),
  createdAt: z.string().datetime(),
});

export type DiffractiveReading = z.infer<typeof DiffractiveReadingSchema>;
export type DiffractiveReadingInput = z.input<typeof DiffractiveReadingSchema>;

export interface CreateDiffractiveReadingInput {
  fragment: DiffractiveFragment;
  pass1?: Partial<Pass1>;
  pass2?: Partial<Pass2>;
  pass3?: Partial<Pass3>;
  pass4: DiffractiveCut;
  verdict: Verdict;
  verdictDetail: string;
  action: string;
  tradeoffs?: Tradeoff[];
}

export function createDiffractiveReading(
  input: CreateDiffractiveReadingInput
): DiffractiveReading {
  return DiffractiveReadingSchema.parse({
    id: crypto.randomUUID(),
    fragment: input.fragment,
    pass1: { refraction: input.pass1?.refraction ?? [] },
    pass2: {
      namedPatterns: input.pass2?.namedPatterns ?? [],
      revealedDefaults: input.pass2?.revealedDefaults ?? [],
    },
    pass3: { entanglements: input.pass3?.entanglements ?? [] },
    pass4: input.pass4,
    verdict: input.verdict,
    verdictDetail: input.verdictDetail,
    action: input.action,
    tradeoffs: input.tradeoffs ?? [],
    createdAt: new Date().toISOString(),
  });
}
