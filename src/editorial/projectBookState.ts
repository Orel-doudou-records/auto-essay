import type { DraftUnitStatus } from "../domain/draftUnit";
import type {
  Manuscript,
  ManuscriptChild,
  ManuscriptLeaf,
} from "../domain/manuscript";
import {
  deriveNodeStatus,
  type ResolveLeafStatus,
} from "../domain/manuscriptStatus";
import type { BookPartInput, BookPlanInput } from "./diffractiveReader";

/** Feuille résolue : le statut ET le texte de la version d'unité. */
export interface ResolvedLeaf {
  status: DraftUnitStatus;
  text: string;
}

/**
 * Résout une feuille vers ce que le lecteur diffractif doit voir.
 * Sans I/O : l'appelant charge les unités puis injecte le résolveur.
 */
export type ResolveLeaf = (leaf: ManuscriptLeaf) => ResolvedLeaf;

export interface ProjectBookStateOptions {
  resolveLeaf?: ResolveLeaf;
}

/**
 * Projecteur pur `Manuscript → BookPartInput[]` (ADR-006, D5) : la forme
 * canonique que consomme le lecteur diffractif (D-lite).
 *
 * Règles :
 * - un nœud émet une partie s'il a un texte propre (préambule) OU aucun
 *   enfant (partie planifiée → texte vide) ;
 * - un nœud sans texte propre mais avec des enfants n'émet rien : ses
 *   descendants couvrent le contenu, et leur titre hérite du nœud ;
 * - une feuille émet une partie (id `unit:<unitId>:<version>`, texte résolu) ;
 * - le statut d'un nœud est dérivé (le plus faible de ses descendants).
 */
export function projectBookState(
  manuscript: Manuscript,
  options: ProjectBookStateOptions = {}
): BookPartInput[] {
  const resolveLeaf: ResolveLeaf =
    options.resolveLeaf ?? (() => ({ status: "drafting", text: "" }));
  const resolveLeafStatus: ResolveLeafStatus = (leaf) =>
    resolveLeaf(leaf).status;

  const parts: BookPartInput[] = [];
  collectParts(manuscript.tree, resolveLeaf, resolveLeafStatus, undefined, parts);
  return parts;
}

function collectParts(
  children: Manuscript["tree"],
  resolveLeaf: ResolveLeaf,
  resolveLeafStatus: ResolveLeafStatus,
  inheritedTitle: string | undefined,
  out: BookPartInput[]
): void {
  for (const child of children) {
    if (child.kind === "leaf") {
      const resolved = resolveLeaf(child);
      out.push({
        id: `unit:${child.unitId}:${child.version}`,
        title: inheritedTitle ?? `Unité ${child.unitId}@${child.version}`,
        status: resolved.status,
        text: resolved.text,
      });
      continue;
    }

    const hasOwnText = Boolean(child.text?.trim());
    if (!hasOwnText && child.children.length > 0) {
      collectParts(
        child.children,
        resolveLeaf,
        resolveLeafStatus,
        child.title,
        out
      );
      continue;
    }

    out.push({
      id: child.id,
      title: child.title,
      status: deriveNodeStatus(child, resolveLeafStatus),
      text: child.text ?? "",
    });
    collectParts(child.children, resolveLeaf, resolveLeafStatus, child.title, out);
  }
}
/**
 * Projette le plan d'ébauche d'un manuscrit (spec E) : les chapitres qui
 * portent un plan deviennent la forme lue par le lecteur diffractif
 * (section « Le plan du livre »). Les aperçus et notes sont conservés ;
 * le contenu des unités déjà écrites n'apparaît pas ici (c'est le rôle de
 * projectBookState). Pur, sans I/O.
 */
export function projectBookPlan(manuscript: Manuscript): BookPlanInput[] {
  const parts: BookPlanInput[] = [];
  collectPlanParts(manuscript.tree, parts);
  return parts;
}

function collectPlanParts(
  children: ManuscriptChild[],
  out: BookPlanInput[]
): void {
  for (const child of children) {
    if (child.kind !== "node") continue;
    if (child.plan && child.plan.length > 0) {
      out.push({
        partId: child.id,
        partTitle: child.title,
        entries: child.plan.map((entry) => ({
          id: entry.id,
          subject: entry.subject,
          preview: entry.preview,
          notes: (entry.notes ?? []).map((note) => ({
            kind: note.kind,
            text: note.text,
          })),
        })),
      });
    }
    collectPlanParts(child.children, out);
  }
}
