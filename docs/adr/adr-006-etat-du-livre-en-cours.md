# ADR-006 — L'état du livre en cours : le diffract lit un chantier, pas un texte fini

Statut : **décision partielle** (D-lite actée) — arbre de modélisation D en cours
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

Le prompt rend la section « État du livre en cours » : statut par partie,
parties planifiées, coupes déjà édictées, et la consigne que l'ébauche se
retravaille, le rédigé ne change que par une coupe nette, et qu'on ne
contredit pas une coupe actée en silence.

Branchement complet : CLI (`--book-parts`, `--cuts`), batch, pipeline, API
(schémas zod + `DiffractionService`).

Conséquences : le verdict peut désormais être sensible à l'ébauche (« intègre
tel quel dans l'Acte II (ébauche) » vs « remplace le passage rédigé de
l'Acte I »), et composé avec les décisions déjà actées.

## Arbre de décision en cours (la modélisation D)

La racine du problème est que le domaine ne représente pas la structure du
manuscrit : `Manuscript` est une liste plate d'unités, et les
`EditorialScope` (`sectionId`/`paragraphId`) pointent vers des adresses qui
n'existent pas comme objets.

### Q1 — Qui possède la structure ?
Options :
- (a) `Manuscript` devient un arbre (chapitres → sections → unités), chaque
  nœud portant un statut.
- (b) Nouvel objet `Outline`/structure séparé, référencé par le manuscrit.
- (c) Structure dérivée des `EditorialScope` (aucune nouvelle possession).

➡️ Recommandation : (a) — le manuscrit possède la structure, c'est le livre.

### Q2 — Où vit le statut d'ébauche ?
Options :
- (a) Sur la `DraftUnit` (source de vérité existante : `DraftUnitStatus`).
- (b) Sur la référence de position dans le manuscrit (statut contextuel à
  l'assemblage).
- (c) Les deux : statut de rédaction sur l'unité, statut d'assemblage sur la
  référence (une unité rédigée peut être montée dans un chapitre ébauche).

➡️ Recommandation : (c).

### Q3 — Profondeur et granularité
Le judéofuturisme s'écrit en Actes → chapitres → scènes. Profondeur libre ou
niveaux fixes ?

➡️ Recommandation : arbre à profondeur libre ; les noms (acte/chapitre/scène)
ne sont qu'un cas particulier ; les feuilles textuelles sont des `DraftUnit`.

### Q4 — Versioning
`ManuscriptUnitReference` pointe `unitId + version`. Le statut lu par le
diffract est celui de la version référencée ?

➡️ Recommandation : oui — statut dérivé de la version référencée.

### Q5 — Le projecteur bookParts
Le format `bookParts` (id/title/status/text) est-il LA forme canonique de
lecture, produite par un projecteur pur `Manuscript → BookPartInput[]` ?

➡️ Recommandation : oui — fonction pure du domaine, testable, qui remplacera
la construction manuelle des bookParts (actuellement fichiers JSON).

### Q6 — Plan et structure
Les plans de section/paragraphe existent (`EditorialPlan`, scopes section) ;
vivent-ils dans l'arbre (nœuds non-feuilles avec fonction argumentative) ?

➡️ Recommandation : les nœuds non-feuilles peuvent porter une fonction
argumentative, mais c'est à arbitrer avec la cheminée plan existante.

## En attente
Les réponses de l'auteur à Q1–Q6 (grill round 1). L'ADR sera finalisée à
mesure que les décisions sont prises.