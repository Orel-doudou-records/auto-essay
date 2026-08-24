# ADR-006 — L'état du livre en cours : le diffract lit un chantier, pas un texte fini

Statut : **accepté** — grill terminé, toutes les décisions actées
Date : 2026-08-24

## Contexte

Le lecteur diffractif jugeait le livre comme un objet fini : le prompt disait
« livre en cours d'écriture » mais aucune donnée ne le concrétisait. Le modèle
inventait des positions (« faire du fragment le pivot du chapitre 2 ») sans
savoir si le chapitre 2 existait, et ne distinguait pas une ébauche d'un
passage rédigé. Constat de l'auteur : « le modèle juge le manuscrit en cours
comme s'il était déjà clôturé ».

## Décision actée (D-lite — version branchable, PR #48)

`DiffractiveReadingRequest` accepte désormais :

- `bookParts[]` — le livre découpé en parties `{ id, title, status, text }`,
  `status` étant un `DraftUnitStatus`. Une partie peut être « planifiée »
  (`text` vide) : c'est un état légitime du chantier.
- `existingCuts[]` — les coupes déjà édictées par l'auteur `{ scope, verdict,
  cut }`. Le lecteur compose avec l'existant au lieu de le réinventer.

Le prompt rend la section « État du livre en cours ». Branchement complet :
CLI (`--book-parts`, `--cuts`), batch, pipeline, API (schémas zod +
`DiffractionService`).

## Décisions de modélisation D (toutes actées par l'auteur le 2026-08-24)

### Q1–Q6 (round 1)

1. **La structure est possédée par le manuscrit** : `Manuscript` devient un
   arbre — chapitres → sections → unités. Les nœuds non-feuilles portent un
   statut ; les feuilles référencent une `DraftUnit` (`unitId + version`).
2. **Le statut vit aux deux endroits** : statut de rédaction sur la `DraftUnit`
   (source de vérité) ; statut d'assemblage sur la référence dans le manuscrit
   (une unité rédigée peut être montée dans un chapitre ébauche).
3. **Profondeur libre** : acte/chapitre/scène n'est qu'un cas particulier ;
   les feuilles textuelles sont des `DraftUnit`.
4. **Statut dérivé de la version référencée** : le statut lu par le diffract
   est celui de la version pointée.
5. **Le projecteur `bookParts` est la forme canonique de lecture** : fonction
   pure `Manuscript → BookPartInput[]`, testable, qui remplacera les fichiers
   JSON manuels.
6. **Les nœuds non-feuilles peuvent porter une fonction argumentative** : à
   articuler avec la cheminée `EditorialPlan` existante.

### R2-Q1–Q4 (round 2)

7. **Nœuds mixtes** : un nœud non-feuille peut avoir un `text?` propre
   (préambule d'acte) en plus de ses enfants ; les feuilles restent des
   `DraftUnit`. Le projecteur expose une partie par nœud porteur de texte.
8. **Les nœuds sont les cibles des `EditorialScope`** : id stable par nœud, les
   scopes section/paragraph le référencent — résout le trou du modèle actuel
   (`sectionId`/`paragraphId` sans objet).
9. **Statut non-feuille dérivé** : le statut d'un nœud = le plus faible de ses
   descendants (pas de double source de vérité).
10. **La position dans l'arbre est l'ordre** : suppression du champ `order`
    plat de `ManuscriptUnitReference`.

## Conséquences
Le verdict peut être sensible à l'ébauche (« intègre tel quel dans l'Acte II
(ébauche) » vs « remplace le passage rédigé de l'Acte I »), et composé avec
les décisions déjà actées. Le chantier D (arbre + projecteur + migration de
l'exemple judéofuturisme) est spécifié séparément (spec D).