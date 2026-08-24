# ADR-006 — L'état du livre en cours : le diffract lit un chantier, pas un texte fini

Statut : **décisions Q1–Q6 actées** — round 2 en cours (questions restantes)
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

## Décisions de modélisation D (Q1–Q6, actées par l'auteur le 2026-08-24)

1. **La structure est possédée par le manuscrit** (Q1-a) : `Manuscript` devient
   un arbre — chapitres → sections → unités. Les nœuds non-feuilles portent un
   statut ; les feuilles référencent une `DraftUnit` (`unitId + version`).
2. **Le statut vit aux deux endroits** (Q2-c) : statut de rédaction sur la
   `DraftUnit` (source de vérité) ; statut d'assemblage sur la référence dans
   le manuscrit (une unité rédigée peut être montée dans un chapitre ébauche).
3. **Profondeur libre** (Q3) : acte/chapitre/scène n'est qu'un cas particulier
   ; les feuilles textuelles sont des `DraftUnit`.
4. **Statut dérivé de la version référencée** (Q4) : le statut lu par le
   diffract est celui de la version pointée.
5. **Le projecteur `bookParts` est la forme canonique de lecture** (Q5) :
   fonction pure `Manuscript → BookPartInput[]`, testable, qui remplacera les
   fichiers JSON manuels.
6. **Les nœuds non-feuilles peuvent porter une fonction argumentative** (Q6) :
   à articuler avec la cheminée `EditorialPlan` existante.

## Round 2 — questions ouvertes

### R2-Q1 — Les nœuds non-feuilles peuvent-ils porter leur propre texte ?
Un acte ou un chapitre est-il un **conteneur pur** (son texte = concaténation
des feuilles) ou peut-il avoir un **texte propre** (préambule d'acte) en plus
de ses enfants ?
➡️ Recommandation : **mixte** — un nœud non-feuille peut avoir un `text?`
optionnel ; ses feuilles restent des `DraftUnit`. Le projecteur expose une
partie par nœud porteur de texte (propre ou feuille).

### R2-Q2 — Les nœuds deviennent-ils les cibles des `EditorialScope` ?
Aujourd'hui `sectionId`/`paragraphId` pointent vers des adresses sans objet.
Les nœuds de l'arbre deviennent-ils ces objets référencés ?
➡️ Recommandation : **oui** — id stable par nœud, les scopes section/paragraph
le référencent. Résout le trou du modèle actuel.

### R2-Q3 — Statut d'un nœud non-feuille : dérivé ou explicite ?
Un chapitre est-il ÉBAUCHE parce qu'un enfant l'est (dérivé), ou l'auteur
fixe-t-il son statut (explicite) ?
➡️ Recommandation : **dérivé** — le statut d'un nœud = le plus faible de ses
descendants ; pas de double source de vérité. Surcoût possible plus tard si le
besoin apparaît.

### R2-Q4 — La position dans l'arbre remplace-t-elle `order` ?
`ManuscriptUnitReference` porte aujourd'hui un `order` plat. La position dans
l'arbre fait-elle foi ?
➡️ Recommandation : **oui** — l'ordre est la position ; suppression du champ
`order` plat.

## En attente
Réponses de l'auteur à R2-Q1–R2-Q4, puis finalisation de l'ADR et passage au
spec du chantier D (projecteur + migration de l'exemple judéofuturisme).