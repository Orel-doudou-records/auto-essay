# Comment ingérer des sources

Ce guide explique comment importer des documents dans le moteur pour les utiliser comme preuves dans les unités de rédaction.

## Formats supportés

| Format | Fonction | Statut |
|--------|----------|--------|
| Markdown avec frontmatter | `importMarkdown` | Opérationnel |
| BibTeX | `importBibTeX` | Opérationnel |
| PDF | *À venir* | Non implémenté |
| Zotero | *À venir* | Non implémenté |

## Importer un fichier Markdown

Le moteur attend un frontmatter YAML entre triples tirets (`---`), suivi du corps du texte.

```markdown
---
title: "Le Malaise dans la culture"
author: "Sigmund Freud"
date: "1930"
doi: "10.1000/example"
url: "https://archive.org/details/malaise"
tags: ["civilisation", "inconscient"]
---

> La civilisation repose sur la répression des pulsions. (p. 45)

> Le prix de la progrès est la culpabilité culturelle. (p. 78)
```

```typescript
import { importMarkdown } from "@auto-essay/core";
import fs from "fs";

const content = fs.readFileSync("freud-1930.md", "utf-8");
const source = importMarkdown("freud-1930.md", content, project.id);

console.log(source.title);        // "Le Malaise dans la culture"
console.log(source.annotations.length); // 2
```

### Règles d'extraction

- **Citations** : les blocs `> ...` sont extraits comme `Annotation` avec leur contenu et, si présent, le numéro de page `(p. XX)`.
- **Auteurs** : le champ `author` accepte une chaîne ou un tableau. Séparez les auteurs multiples par des virgules dans le tableau.
- **Type de source** : déduit automatiquement (`article` si DOI présent, `pdf` si `source` contient `.pdf`, sinon `markdown`).

## Importer plusieurs fichiers Markdown

```typescript
import { importMarkdownFiles } from "@auto-essay/core";

const files = [
  { path: "source-a.md", content: fs.readFileSync("source-a.md", "utf-8") },
  { path: "source-b.md", content: fs.readFileSync("source-b.md", "utf-8") },
];

const result = importMarkdownFiles(files, project.id);

console.log("Sources :", result.sources.length);
console.log("Erreurs :", result.errors.length);
```

## Importer un fichier BibTeX

```bibtex
@article{habermas1992,
  author  = {Jürgen Habermas},
  title   = {Further Reflections on the Public Sphere},
  journal = {Structural Transformation},
  year    = {1992},
  doi     = {10.2307/2000000},
}

@book{arendt1958,
  author    = {Hannah Arendt},
  title     = {The Human Condition},
  publisher = {University of Chicago Press},
  year      = {1958},
}
```

```typescript
import { importBibTeX } from "@auto-essay/core";

const bibContent = fs.readFileSync("references.bib", "utf-8");
const result = importBibTeX(bibContent, project.id);

for (const source of result.sources) {
  console.log(`${source.title} (${source.authors.join(", ")})`);
}
```

### Limitations du parser BibTeX

- Supporte `@article`, `@book` et `@inproceedings`.
- Les champs imbriqués dans des accolades multiples peuvent être tronqués.
- Les caractères d'échappement LaTeX (`\"{o}`) ne sont pas convertis.

## Construire un evidence pack

Après l'importation, sélectionnez les sources et citations pertinentes pour une unité de rédaction.

```typescript
const evidencePack = {
  sourceIds: [sourceA.id, sourceB.id],
  keyCitations: [
    {
      sourceId: sourceA.id,
      quote: "Le prix de la progrès est la culpabilité culturelle.",
      pageRange: "78",
      context: "Chapitre III sur la culpabilité",
    },
  ],
  supportingClaimIds: [], // IDs de claims déjà validées
  objections: [
    {
      statement: "Freud néglige les aspects économiques de la civilisation.",
      sourceId: sourceB.id,
      responseStrategy: "Admettre la limite et la contourner par la suite.",
    },
  ],
  authorNotes: "Relier la culpabilité freudienne à la thèse sur la répression moderne.",
};
```

## Voir aussi

- [Configurer un projet](configurer-projet.md)
- [Générer des paragraphes](generer-paragraphes.md)
- [Référence : Formats de sortie](../reference/formats-sortie.md)
