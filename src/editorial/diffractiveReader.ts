import { z } from "zod";
import type { StructuredModelClient } from "../evaluation/evaluateEssay";
import {
  createDiffractiveReading,
  VerdictSchema,
  type DiffractiveReading,
} from "../domain/diffractiveReading";

/**
 * Sortie brute attendue du modèle : les quatre passes + le verdict + l'action.
 * Le fragment (statement, claimIds, sourceIds) vient de la requête, pas du modèle.
 */
const RawDiffractiveOutputSchema = z.object({
  pass1: z
    .object({
      refraction: z.array(z.string().min(1)).default([]),
    })
    .default({ refraction: [] }),
  pass2: z
    .object({
      namedPatterns: z.array(z.string().min(1)).default([]),
      revealedDefaults: z
        .array(
          z.object({
            default: z.string().min(1),
            priorCut: z.string().min(1).optional(),
          })
        )
        .default([]),
    })
    .default({ namedPatterns: [], revealedDefaults: [] }),
  pass3: z
    .object({
      entanglements: z
        .array(
          z.object({
            name: z.string().min(1),
            cutIfIntegrated: z.string().min(1),
            becomesIntelligible: z.array(z.string().min(1)).default([]),
            becomesUnintelligible: z.array(z.string().min(1)).default([]),
          })
        )
        .max(4)
        .default([]),
    })
    .default({ entanglements: [] }),
  pass4: z.object({
    cut: z.string().min(1),
    included: z.array(z.string().min(1)).default([]),
    excluded: z.array(z.string().min(1)).default([]),
    cutOfNonAdoption: z.array(z.string().min(1)).default([]),
  }),
  verdict: VerdictSchema,
  action: z.string().min(1),
});

export interface DiffractiveReadingRequest {
  /** La position à diffracter. */
  statement: string;
  /** Claims en formation référencés par le fragment. */
  claimIds?: string[];
  /** Sources référencées par le fragment. */
  sourceIds?: string[];
  /** Le livre en cours d'écriture (extraits ou texte complet). */
  book?: string;
  /** Concepts déjà nommés dans le corpus. */
  concepts?: Array<{ label: string; definition: string }>;
  /** Tensions déjà nommées dans le corpus. */
  tensions?: Array<{ label: string; description: string }>;
}

/**
 * Lecteur diffractif : produit une DiffractiveReading (4 passes + verdict forcé)
 * à partir d'un fragment posé dans le livre.
 */
export class DiffractiveReader {
  constructor(private readonly client: StructuredModelClient) {}

  async read(request: DiffractiveReadingRequest): Promise<DiffractiveReading> {
    const rawOutput = await this.client.generateJson(
      buildDiffractivePrompt(request)
    );
    const parsed = RawDiffractiveOutputSchema.parse(rawOutput);

    return createDiffractiveReading({
      fragment: {
        statement: request.statement,
        claimIds: request.claimIds ?? [],
        sourceIds: request.sourceIds ?? [],
      },
      pass1: parsed.pass1,
      pass2: parsed.pass2,
      pass3: parsed.pass3,
      pass4: parsed.pass4,
      verdict: parsed.verdict,
      action: parsed.action,
    });
  }
}

export function createDiffractiveReader(
  client: StructuredModelClient
): DiffractiveReader {
  return new DiffractiveReader(client);
}

export function buildDiffractivePrompt(
  request: DiffractiveReadingRequest
): string {
  const payload = {
    fragment: {
      statement: request.statement,
      claimIds: request.claimIds ?? [],
      sourceIds: request.sourceIds ?? [],
    },
    book: request.book ?? "",
    concepts: request.concepts ?? [],
    tensions: request.tensions ?? [],
  };

  return `Tu es un lecteur diffractif. Tu appliques la méthode diffractive (Haraway/Barad)
à un fragment posé dans un livre en cours d'écriture.

## Données
\`\`\`json
${JSON.stringify(payload, null, 2)}
\`\`\`

## Méthode — quatre passes

**Pass 1 — le fragment à travers le livre.** Pose le fragment DANS ce livre :
que devient-il une fois diffracté ici ? 3–6 réfractions. Si rien n'est non-évident,
retourne une liste vide (c'est une réponse honnête, pas un échec).

**Pass 2 — le livre à travers le fragment.** Que révèle le fragment sur le livre ?
Nomme les motifs latents qu'il rend visibles, et les defaults que le livre traitait
comme acquis alors qu'ils sont des choix. Pour chaque default, indique la coupe
antérieure qui l'a installé si identifiable, sinon "unknown cut:".

**Pass 3 — les enchevêtrements.** Identifie 2–4 lieux où le fragment et le livre
sont déjà intra-agissants, indépendamment de toute adoption. Pour chacun, nomme la
coupe que son intégration opérerait, et ce qu'elle rendrait intelligible /
inintelligible. Si rien d'honnête, liste vide.

**Pass 4 — la coupe agentielle.** Nomme LA coupe que l'adoption du fragment édicte :
ce qu'elle inclut, ce qu'elle exclut, et ce que la NON-décision exclurait aussi.
Les frontières sont édictées, pas trouvées.

## Verdict forcé
Choisis UN verdict, sans « ça dépend » :
- integrate_now : intégrer tel quel
- adapt_differently : intégrer en déplaçant la coupe
- incubate : pas encore mûr, garder en trace active
- archive : garder comme trace/matériau, sans exécuter
- discard : écarter

## Action
Une seule action concrète pour cette session.

## Discipline anti-slop
- Ne fabrique jamais un insight synthétique : une liste vide vaut mieux qu'un remplissage.
- Préfixe toute spéculation par « speculation: ».
- Ne conclus jamais par « ça dépend » : nomme toujours la coupe.

## Format JSON strict
{
  "pass1": { "refraction": ["string"] },
  "pass2": { "namedPatterns": ["string"], "revealedDefaults": [{"default": "string", "priorCut": "string"}] },
  "pass3": { "entanglements": [{"name": "string", "cutIfIntegrated": "string", "becomesIntelligible": ["string"], "becomesUnintelligible": ["string"]}] },
  "pass4": { "cut": "string", "included": ["string"], "excluded": ["string"], "cutOfNonAdoption": ["string"] },
  "verdict": "integrate_now|adapt_differently|incubate|archive|discard",
  "action": "string"
}`;
}
