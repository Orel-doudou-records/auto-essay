import { z } from "zod";
import type { StructuredModelClient } from "../evaluation/evaluateEssay";
import {
  createDiffractiveReading,
  VerdictSchema,
  type DiffractiveReading,
} from "../domain/diffractiveReading";
import {
  DraftUnitStatusSchema,
  type DraftUnitStatus,
} from "../domain/draftUnit";

/**
 * Sortie brute attendue du modèle : les quatre passes + le verdict (et sa
 * spécificité) + l'action + la matrice de compromis. Le fragment (statement,
 * claimIds, sourceIds) vient de la requête, pas du modèle.
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
  verdictDetail: z.string().min(1),
  action: z.string().min(1),
  tradeoffs: z
    .array(
      z.object({
        path: z.string().min(1),
        effort: z.string().min(1),
        reversibility: z.string().min(1),
        leverage: z.string().min(1),
        distractionTax: z.string().min(1),
        verdict: VerdictSchema,
      })
    )
    .default([]),
  planImpacts: z
    .array(
      z.object({
        partId: z.string().min(1),
        partTitle: z.string().min(1),
        entryId: z.string().min(1).optional(),
        impact: z.string().min(1),
      })
    )
    .default([]),
});

/**
 * Une partie du livre en cours d'écriture, avec son statut de rédaction.
 * `text` peut être vide : une partie planifiée mais pas encore écrite est un
 * état légitime que le lecteur doit connaître (« (pas encore écrit) »).
 */
export interface BookPartInput {
  id: string;
  title: string;
  status: DraftUnitStatus;
  text: string;
}

/**
 * Une coupe déjà édictée par l'auteur (décision active). Le lecteur diffractif
 * compose avec ces coupes au lieu de les réinventer ou de les contredire en
 * silence.
 */
export interface ExistingCutInput {
  scope: string;
  verdict: string;
  cut: string;
}

export interface BookPlanNoteInput {
  kind: "human" | "agent";
  text: string;
}

export interface BookPlanEntryInput {
  id: string;
  subject: string;
  preview?: string;
  notes?: BookPlanNoteInput[];
}

export interface BookPlanInput {
  partId: string;
  partTitle: string;
  entries: BookPlanEntryInput[];
}

export interface DiffractiveReadingRequest {
  /** La position à diffracter. */
  statement: string;
  /** Claims en formation référencés par le fragment. */
  claimIds?: string[];
  /** Sources référencées par le fragment. */
  sourceIds?: string[];
  /** Le livre en cours d'écriture (texte brut, forme historique). */
  book?: string;
  /**
   * Le livre en cours d'écriture, structuré partie par partie avec statut.
   * Si fourni, prime sur `book` : le lecteur voit l'état du chantier.
   */
  bookParts?: BookPartInput[];
  /** Coupes déjà édictées — le verdict compose avec l'existant. */
  existingCuts?: ExistingCutInput[];
  /** Le plan d'ébauche du livre (chapitres → paragraphes prévus). */
  bookPlan?: BookPlanInput[];
  /** Concepts déjà nommés dans le corpus. */
  concepts?: Array<{ label: string; definition: string }>;
  /** Tensions déjà nommées dans le corpus. */
  tensions?: Array<{ label: string; description: string }>;
}

const STATUS_LABELS: Record<DraftUnitStatus, string> = {
  drafting: "ÉBAUCHE",
  reviewing: "EN RÉVISION",
  revising: "EN RÉÉCRITURE",
  verified: "RÉDIGÉ (validé)",
  published: "PUBLIÉ",
  archived: "ARCHIVÉ",
};

/** Libellé français du statut d'une partie, pour le prompt. */
export function statusLabel(status: DraftUnitStatus): string {
  return STATUS_LABELS[status] ?? status;
}

/** Une ligne « [STATUT] titre (id) — texte | (pas encore écrit) ». */
export function formatBookPart(part: BookPartInput): string {
  const body = part.text.trim()
    ? ` — ${part.text}`
    : " — (pas encore écrit)";
  return `- [${statusLabel(part.status)}] ${part.title} (${part.id})${body}`;
}

/** Une ligne « scope : verdict verdict — cut ». */
export function formatExistingCut(cut: ExistingCutInput): string {
  return `- ${cut.scope} : verdict ${cut.verdict} — ${cut.cut}`;
}

/** Une ligne d'entrée de plan : [id] sujet — aperçu : … | note (humain/agent) : …. */
export function formatPlanEntry(entry: BookPlanEntryInput): string {
  const parts = ["[" + entry.id + "] " + entry.subject];
  if (entry.preview && entry.preview.trim()) {
    parts.push("aperçu : " + entry.preview);
  }
  for (const note of entry.notes ?? []) {
    parts.push(
      "note (" + (note.kind === "human" ? "humain" : "agent") + ") : " + note.text
    );
  }
  return "- " + parts.join(" — ");
}

/** Un chapitre porteur de plan, sous forme lisible pour le prompt. */
export function formatPlanPart(part: BookPlanInput): string {
  return [
    "### " + part.partTitle + " (" + part.partId + ")",
    ...part.entries.map(formatPlanEntry),
  ].join("\n");
}

/** Validation légère d'un bookParts fourni (déterministe, sans I/O). */
export function assertBookPartsValid(parts: BookPartInput[]): void {
  if (parts.length === 0) {
    throw new Error("bookParts must not be empty");
  }
  const ids = new Set(parts.map((part) => part.id));
  if (ids.size !== parts.length) {
    throw new Error("bookParts ids must be unique");
  }
  for (const part of parts) {
    if (!part.title.trim()) {
      throw new Error(`bookParts part '${part.id}' requires a title`);
    }
    if (!DraftUnitStatusSchema.safeParse(part.status).success) {
      throw new Error(
        `bookParts part '${part.id}' has invalid status '${part.status}'`
      );
    }
  }
}

/** Validation légère d'un bookPlan fourni (déterministe, sans I/O). */
export function assertBookPlanValid(plan: BookPlanInput[]): void {
  if (plan.length === 0) {
    throw new Error("bookPlan must not be empty");
  }
  const partIds = new Set(plan.map((part) => part.partId));
  if (partIds.size !== plan.length) {
    throw new Error("bookPlan partIds must be unique");
  }
  for (const part of plan) {
    if (!part.partTitle.trim()) {
      throw new Error("bookPlan part '" + part.partId + "' requires a partTitle");
    }
    if (part.entries.length === 0) {
      throw new Error("bookPlan part '" + part.partId + "' requires at least one entry");
    }
    const entryIds = new Set(part.entries.map((entry) => entry.id));
    if (entryIds.size !== part.entries.length) {
      throw new Error("bookPlan part '" + part.partId + "' has duplicated entry ids");
    }
    for (const entry of part.entries) {
      if (!entry.subject.trim()) {
        throw new Error(
          "bookPlan entry '" + entry.id + "' in part '" + part.partId + "' requires a subject"
        );
      }
    }
  }
}

/** Section « État du livre en cours » du prompt (statuts + coupes). */
export function buildBookStateSection(
  parts: BookPartInput[],
  cuts: ExistingCutInput[]
): string {
  const lines: string[] = ["## État du livre en cours"];
  if (parts.length > 0) {
    lines.push(
      "Le livre est un chantier, pas un texte fini. Chaque partie porte un statut :",
      ...parts.map(formatBookPart)
    );
  }
  if (cuts.length > 0) {
    lines.push(
      "",
      "Coupes déjà édictées (décisions actives de l'auteur) :",
      ...cuts.map(formatExistingCut)
    );
  }
  lines.push(
    "",
    "Le statut des parties compte pour la lecture : une partie en ébauche peut être retravaillée ou réécrite ; une partie rédigée ne doit changer que par une coupe nette ; une partie planifiée (pas encore écrite) peut accueillir le fragment. Ne recommande pas une coupe déjà édictée, et ne la contredis pas sans le dire."
  );
  return lines.join("\n");
}

/**
 * Lecteur diffractif : produit une DiffractiveReading (4 passes + verdict forcé
 * + matrice de compromis) à partir d'un fragment posé dans le livre.
 */
/** Section « Le plan du livre » du prompt (paragraphes prévus + notes). */
export function buildBookPlanSection(plan: BookPlanInput[]): string {
  const lines: string[] = [
    "## Le plan du livre",
    "Ces paragraphes sont PRÉVUS mais pas encore écrits. Leurs aperçus et notes (humain/agent) indiquent l'intention. La position est l'ordre. Un choix d'écriture dans le fragment peut affecter un élément du plan ailleurs dans le livre (parfois plusieurs chapitres plus loin).",
  ];
  for (const part of plan) {
    lines.push("", formatPlanPart(part));
  }
  return lines.join("\n");
}

export class DiffractiveReader {
  constructor(private readonly client: StructuredModelClient) {}

  async read(request: DiffractiveReadingRequest): Promise<DiffractiveReading> {
    if (request.bookParts) {
      assertBookPartsValid(request.bookParts);
    }
    if (request.bookPlan) {
      assertBookPlanValid(request.bookPlan);
    }
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
      verdictDetail: parsed.verdictDetail,
      action: parsed.action,
      tradeoffs: parsed.tradeoffs,
      planImpacts: parsed.planImpacts,
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

  const parts = request.bookParts ?? [];
  const cuts = request.existingCuts ?? [];
  const hasBookState = parts.length > 0 || cuts.length > 0;
  const bookState = hasBookState
    ? buildBookStateSection(parts, cuts)
    : "";
  const plan = request.bookPlan ?? [];
  const planSection = plan.length > 0 ? buildBookPlanSection(plan) : "";

  return `Tu es un lecteur diffractif. Tu appliques la méthode diffractive (Haraway/Barad)
à un fragment posé dans un livre en cours d'écriture.

## Données
\`\`\`json
${JSON.stringify(payload, null, 2)}
\`\`\`

${bookState ? `${bookState}\n\n` : ""}${planSection ? `${planSection}\n\n` : ""}## Méthode — quatre passes

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
Choisis UN verdict, sans « ça dépend », et donne sa spécificité (≤ 15 mots) :
- integrate_now : intègre tel quel — verdictDetail = pourquoi maintenant
- adapt_differently : intègre en déplaçant la coupe — verdictDetail = comment
- incubate : pas encore mûr — verdictDetail = le déclencheur concret de réexamen
- archive : garde comme trace sans exécuter — verdictDetail = ce qu'on garde
- discard : écarte — verdictDetail = pourquoi

## Matrice de compromis
Énumère 3–5 chemins d'adoption réalistes, dont OBLIGATOIREMENT « ne rien changer »
et au moins un « intégrer autrement que le fragment le propose ». Pour chaque chemin :
effort (coût d'intégration), reversibility (peut-on retirer la coupe proprement),
leverage (levier argumentatif), distractionTax (ce qui s'arrête pendant), et le
verdict honnête pour CE chemin. Si une case est inconnue, écris « inconnu — besoin
de <preuve> » plutôt que deviner.

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
  "verdictDetail": "string",
  "action": "string",
  "tradeoffs": [{"path": "string", "effort": "string", "reversibility": "string", "leverage": "string", "distractionTax": "string", "verdict": "integrate_now|adapt_differently|incubate|archive|discard"}],
  "planImpacts": [{"partId": "string", "partTitle": "string", "entryId": "string", "impact": "string"}]
}`;
}