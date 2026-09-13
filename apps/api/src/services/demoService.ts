import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DraftUnitSchema,
  extractBookBibliography,
  extractConcepts,
  extractTensions,
  ManuscriptSchema,
  projectBookState,
  type BookBibliographyInput,
  type BookPartInput,
  type BookPlanInput,
} from "@auto-essay/core";

/**
 * Démo distribuable : contexte de lecture du projet Judéofuturisme, chapitre 2
 * « Le salon ».
 *
 * Le endpoint sert un contexte PRÊT À POSTER sur POST /api/diffract :
 * l'état du livre (projectBookState appliqué au manuscrit), le plan, les
 * concepts/tensions et la bibliothèque déjà projetée du chapitre.
 * Aucune logique de retrieval ni de graphe n'est exécutée ici : Diffract
 * consomme uniquement une matière documentaire préparée en amont.
 */

const here = dirname(fileURLToPath(import.meta.url));
const assets = join(here, "..", "demo", "judeofuturisme");
const read = (name: string): string => readFileSync(join(assets, name), "utf8");

export interface SuggestedFragment {
  label: string;
  statement: string;
}

export interface JudeofuturismeDemo {
  id: string;
  title: string;
  chapter: { id: string; title: string };
  context: {
    bookParts: BookPartInput[];
    bookPlan: BookPlanInput[];
    concepts: Array<{ label: string; definition: string }>;
    tensions: Array<{ label: string; description: string }>;
    bookBibliography: BookBibliographyInput;
  };
  sourcesCount: number;
  suggestedFragments: SuggestedFragment[];
}

function buildDemo(): JudeofuturismeDemo {
  const manuscript = ManuscriptSchema.parse(JSON.parse(read("manuscript.json")));
  const rawUnits = JSON.parse(read("units.json")) as unknown[];
  const units = rawUnits.map((u) => DraftUnitSchema.parse(u));
  const unitByRef = new Map(
    units.map((u) => [`${u.id}@${u.version}`, u])
  );
  const bookParts = projectBookState(manuscript, {
    resolveLeaf(leaf: { unitId: string; version: number }) {
      const unit = unitByRef.get(`${leaf.unitId}@${leaf.version}`);
      return unit
        ? { status: unit.status, text: unit.content }
        : { status: "drafting", text: "" };
    },
  });

  const bookPlan = JSON.parse(read("plan.json")) as BookPlanInput[];
  const concepts = extractConcepts(JSON.parse(read("concepts.json")));
  const tensions = extractTensions(JSON.parse(read("tensions.json")));
  const bookBibliography = extractBookBibliography(
    JSON.parse(read("library-chap2.json"))
  ) ?? { entries: [] };

  return {
    id: "judeofuturisme",
    title: manuscript.title,
    chapter: { id: "chap-2", title: "Chapitre 2 - Le salon" },
    context: {
      bookParts,
      bookPlan,
      concepts,
      tensions,
      bookBibliography,
    },
    sourcesCount: bookBibliography.entries.length,
    suggestedFragments: [
      {
        label: "chap2-14/16 — Star Trek, Brooks, le salon dans la cabine",
        statement:
          "Le vaisseau est un salon : la SF juive ne met pas les juifs dans les étoiles, elle met l'étoile dans la cabine, et la cabine est une diaspora qui continue.",
      },
      {
        label: "chap2-09/13 — Asimov, Gernsback, Joanna Russ",
        statement:
          "Asimov, Hugo Gernsback et Joanna Russ ne peuplent pas l'espace : ils installent le salon dans la cabine, et la SF juive devient une cartographie des problèmes juifs.",
      },
      {
        label: "chap2-16 — la question de Brooks",
        statement:
          "La question de Mel Brooks — mais où sont les juifs dans l'espace ? — contient déjà sa réponse : dans la cabine, autour de la table, en train de transformer l'exil en technique de survie.",
      },
      {
        label: "chap2-12 — Superman, le masque",
        statement:
          "Superman est un juif sans nom : le masque n'est pas une fuite mais le geste exact par lequel l'universel se fabrique à partir du particulier.",
      },
    ],
  };
}

let cached: JudeofuturismeDemo | undefined;

/** Contexte de démo calculé une fois ; zéro I/O après initialisation. */
export function getJudeofuturismeDemo(): JudeofuturismeDemo {
  cached ??= buildDemo();
  return cached;
}
