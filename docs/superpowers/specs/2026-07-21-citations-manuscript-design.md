# Citations localisables et manuscrit composé — conception

## But

Permettre à Auto Essay de produire un manuscrit à partir de versions précises de `DraftUnit`, avec une bibliographie APA dérivée uniquement des sources réellement citées, sans remplacer `FileRegistry`.

## Décision

L'application ajoute trois objets légers :

- `Citation` : une preuve localisable, identifiée, liée à une `Source` existante ;
- `CitationUse` : l'emploi d'une citation dans une version déterminée de `DraftUnit` ;
- `Manuscript` : un ordre de références `DraftUnit@version`, sans copie de leur contenu.

`Source`, `Claim`, `DraftUnit`, `EditorialPlan` et `FileRegistry` gardent leurs responsabilités actuelles. En particulier, `FileRegistry` reste le seul mécanisme de persistance et de versionnement des unités.

## Contrats

### Citation

Une citation contient `id`, `projectId`, `sourceId`, `quote`, `locator`, `context`, `verificationStatus` et `createdAt`.

`locator` est un objet `{ kind, value }`, avec `kind` dans `page`, `chapter`, `section`, `timestamp`, `url_fragment` ou `other`. La citation ne duplique ni le contenu de la source, ni un claim, ni un extrait de manuscrit.

### CitationUse

Un usage contient `citationId`, `draftUnitId`, `draftUnitVersion` et, si la citation vise un passage du texte produit, une plage de caractères optionnelle `{ start, end }`. `start` est inclusif, `end` exclusif et `start < end`.

`DraftUnit.citationUses` est un tableau par défaut vide. Il décrit uniquement les citations réellement employées par cette version. `EvidencePack.keyCitations` reste intact : il représente un matériau de préparation historique, pas une preuve d'usage final.

### Manuscript

Un manuscrit contient `id`, `projectId`, `title`, `units`, `createdAt` et `updatedAt`. Chaque entrée de `units` contient `unitId`, `version` et `order`. Les ordres et les couples `(unitId, version)` doivent être uniques.

## Compilation

`compileManuscript(manuscript, units, citations, sources)` :

1. vérifie qu'il existe exactement une unité pour chaque référence `unitId@version` ;
2. ordonne les unités et concatène leur contenu sans le modifier ;
3. résout chaque `CitationUse` vers une `Citation`, puis chaque citation vers une `Source` du même projet ;
4. déduplique les sources par `sourceId` dans l'ordre de première apparition ;
5. produit le Markdown et une bibliographie APA.

La compilation échoue explicitement pour une unité/version, citation ou source absente, pour une référence de projet différente, ou pour une plage de caractères hors du contenu. Elle ne choisit jamais une autre version disponible.

## APA minimal et déterministe

La bibliographie utilise les métadonnées existantes de `Source` : auteurs, date de publication, titre, éditeur, DOI et URL. Les auteurs absents donnent le titre en position d'auteur ; une date absente donne `(n.d.)`; DOI est préféré à URL. Ce rendu est une bibliographie APA minimale, sans inventer volume, numéro ou pages bibliographiques qui ne sont pas présents dans le modèle.

## Hors périmètre

- moteur de recherche de sources ou connecteur Zotero ;
- remplacement de `FileRegistry` ;
- migration de données existantes ;
- formatage APA exhaustif selon tous les types de ressources ;
- interface graphique de composition.

## Critères d'acceptation

- les appels historiques à `createDraftUnit` produisent `citationUses: []` ;
- un usage est lié à une version précise et sa plage est validée ;
- un manuscrit refuse les ordres ou références dupliqués ;
- l'export inclut seulement les sources réellement utilisées, une fois chacune, au format APA minimal ;
- une unité/version manquante provoque une erreur explicite ;
- tous les nouveaux comportements sont testés en rouge puis en vert.
