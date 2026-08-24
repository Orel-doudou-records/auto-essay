import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ConceptSchema,
  DraftUnitSchema,
  EssayProjectSchema,
  ManuscriptSchema,
  RelationAnalyzer,
  TensionSchema,
  createClaim,
  importBibTeX,
  projectBookState,
  type Claim,
} from "@auto-essay/core";

const here = dirname(fileURLToPath(import.meta.url));
const read = (name: string): string => readFileSync(join(here, name), "utf8");

// 1. Charger le profil et le catalogue conceptuel comme données (pas du code)
const project = EssayProjectSchema.parse(JSON.parse(read("project.json")));
const concepts = JSON.parse(read("concepts.json")).map((c: unknown) =>
  ConceptSchema.parse(c)
);
const tensions = JSON.parse(read("tensions.json")).map((t: unknown) =>
  TensionSchema.parse(t)
);

// 2. Ingérer la bibliographie
const { sources, errors } = importBibTeX(read("bibliography.bib"), project.id);
if (errors.length > 0) {
  console.error("Erreurs d'import bibliographie :", errors);
}

// 3. Construire deux claims d'illustration ancrées aux sources importées
const claims: Claim[] = [];
if (sources.length >= 1) {
  const first = createClaim({
    projectId: project.id,
    statement:
      "La temporalité messianique se reformule à travers les techniques contemporaines.",
    confidenceLevel: "probable",
    claimType: "interpretation",
    sourceIds: [sources[0].id],
  });
  claims.push(first);

  if (sources.length >= 2) {
    claims.push(
      createClaim({
        projectId: project.id,
        statement: "La mémoire diasporique résiste à la dissolution technique.",
        confidenceLevel: "probable",
        claimType: "counterclaim",
        sourceIds: [sources[1].id],
        contradictionOf: first.id,
      })
    );
  }
}

// 4. Découvrir les relations (mode déterministe, sans LLM)
const analyzer = new RelationAnalyzer();
const relations = await analyzer.analyze({
  scope: { level: "project", projectId: project.id },
  sources,
  claims,
  concepts,
  tensions,
});

// 5. Projeter l'état du livre en cours : l'arbre du manuscrit devient la
//    forme canonique que lira le moteur de pensée (projectBookState)
const manuscript = ManuscriptSchema.parse(JSON.parse(read("manuscript.json")));
const units = JSON.parse(read("units.json")).map((u: unknown) =>
  DraftUnitSchema.parse(u)
);
const unitByRef = new Map(units.map((u) => [`${u.id}@${u.version}`, u]));
const bookParts = projectBookState(manuscript, {
  resolveLeaf(leaf) {
    const unit = unitByRef.get(`${leaf.unitId}@${leaf.version}`);
    return unit
      ? { status: unit.status, text: unit.content }
      : { status: "drafting", text: "" };
  },
});

// 6. Résumé
console.log(
  JSON.stringify(
    {
      project: project.title,
      sources: sources.length,
      concepts: concepts.map((c: { label: string }) => c.label),
      tensions: tensions.map((t: { label: string }) => t.label),
      relations: relations.map((r) => ({
        type: r.type,
        description: r.description,
      })),
      bookParts: bookParts.map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        chars: p.text.length,
      })),
    },
    null,
    2
  )
);