# CC1 — Collaborative Manuscript Core

## Status

Ready for ticketing. Derived from Wayfinder #158 and decisions #159–#164, #166.

## Problem Statement

AutoEssay possède déjà un manuscrit structuré, des unités versionnées, des propositions de révision, de la provenance et plusieurs formes de validation auteur. AutoFiction et de futurs Writing Engines auront besoin des mêmes garanties de structure, d'identité, de versioning et de collaboration sans reprendre les objets argumentatifs propres à AutoEssay.

En parallèle, le même problème existe dans le travail éditorial humain : auteur, éditeur, correcteur et relecteur doivent pouvoir travailler sur un manuscrit commun, proposer des changements, les commenter, les accepter partiellement, conserver les variantes et comprendre l'historique sans manipuler Git.

Le système actuel ne fournit pas de noyau commun capable de couvrir ces deux régimes. Une extraction trop proche d'AutoEssay exporterait des concepts comme `Claim`, `Evidence`, `EditorialDecision` ou `DraftUnit` avec une sémantique trop spécialisée. Une copie de Git imposerait fichiers, commits et pull requests comme modèle utilisateur. Un éditeur temps réel ou un CRDT pris comme source de vérité confondrait synchronisation technique et autorité éditoriale.

Le Collaborative Manuscript Core doit donc porter le **cycle de vie collaboratif du manuscrit**, de l'écriture à l'édition, indépendamment des moteurs métier et du rendu final.

## Solution

Introduire un noyau de domaine autonome, consommable sans AutoEssay ni AutoFiction, fondé sur quatre principes :

1. **Identité littéraire stable** : le manuscrit est un arbre de `LiteraryNode`; le paragraphe est la plus petite identité persistante par défaut. Le contenu est versionné séparément.
2. **Versioning éditorial applicatif** : les révisions forment un DAG à parents multiples. Les modifications sont décrites par des `ChangeSet` sémantiques append-only et peuvent être matérialisées par snapshots.
3. **Collaboration phase-agnostic** : création et édition utilisent les mêmes primitives. La politique `direct | propose` décide si un contributeur peut appliquer un changement dans son espace de travail ou doit le soumettre à validation.
4. **Validation éditoriale distincte de la fusion technique** : une modification techniquement conciliable peut rester non intégrable si elle crée un conflit de sens, de narration, d'argument ou d'intention.

```text
Writing Engine / humain
        │
        ▼
Contributor + Role + Permission
        │
        ▼
Workspace / Variant
        │
        ▼
Revision ── ChangeSet
        │
        ├── direct ───────────────► état de travail autorisé
        │
        └── propose ► Proposal ► Review ► Integration
                                      │
                                      ▼
                              manuscrit canonique
```

Le Core n'est pas un moteur d'écriture. AutoEssay reste propriétaire de ses `Claim`, `Evidence`, `Citation`, `ContentRelation`, décisions argumentatives et orchestration. AutoFiction reste propriétaire de ses personnages, scènes, arcs, canon et états narratifs. Ces objets peuvent être reliés au Core par références génériques `{ kind, id }`, jamais promus automatiquement en primitives partagées.

## User Stories

1. En tant qu'auteur, je peux commencer un manuscrit, écrire progressivement des chapitres, sections et paragraphes, puis continuer à utiliser le même projet pendant les révisions et l'édition.
2. En tant qu'auteur, je peux déplacer ou réécrire un paragraphe sans perdre son identité, ses commentaires ni son historique.
3. En tant qu'auteur, je peux conserver une variante narrative ou argumentative sans qu'elle remplace le manuscrit de référence.
4. En tant qu'éditeur, je peux assigner une tâche à un auteur, un correcteur, un relecteur ou un agent sans changer de modèle métier.
5. En tant que correcteur, je peux produire plusieurs corrections dans une version de travail sans modifier silencieusement le manuscrit canonique.
6. En tant qu'éditeur, je peux préparer une proposition de révision à partir d'un sous-ensemble des changements produits dans une version de travail.
7. En tant qu'auteur, je peux accepter, rejeter ou commenter un changement individuel, une sélection de changements ou toute une proposition.
8. En tant qu'éditeur, je peux intégrer uniquement les changements effectivement validés.
9. En tant qu'auteur travaillant seul, je peux cumuler les rôles d'auteur et d'éditeur sans subir un workflow artificiellement lourd.
10. En tant que Writing Engine, je peux écrire directement dans une version de travail lorsque la politique du projet m'y autorise.
11. En tant que Writing Engine, je peux soumettre une révision à validation lorsque ma politique est `propose`.
12. En tant qu'utilisateur, je peux comprendre qu'une proposition est devenue obsolète parce que le passage a changé depuis sa création, sans connaître les notions de rebase ou de merge Git.
13. En tant qu'utilisateur, je peux voir l'auteur humain ou agent, la base, la raison et les décisions associées à chaque modification.
14. En tant que développeur d'AutoEssay ou AutoFiction, je peux référencer un nœud littéraire depuis mes objets métier sans introduire ces objets dans le Core.
15. En tant que mainteneur, je peux implémenter la persistance avec plusieurs stratégies sans changer les contrats de domaine.

## Implementation Decisions

### 1. Frontière du Core

Le Core possède uniquement la collaboration générique autour d'un manuscrit :

- structure littéraire ;
- identité et versions de contenu ;
- espaces de travail et variantes ;
- révisions et changements ;
- contributeurs, rôles, permissions et assignations ;
- tâches ;
- propositions, reviews et intégrations ;
- provenance collaborative ;
- détection et classification des conflits.

Il ne possède pas :

- le raisonnement d'un Writing Engine ;
- les concepts métier AutoEssay ou AutoFiction ;
- les prompts ou runtimes d'agents ;
- la composition PDF/DOCX/EPUB ;
- l'authentification, la facturation ou les organisations.

Un Core vide de Writing Engine doit rester fonctionnel pour un workflow humain ↔ humain.

### 2. Références génériques

Les extensions métier utilisent une référence minimale :

```ts
export type DomainEntityRef = {
  kind: string;
  id: string;
};
```

Le Core stocke et transporte ces références mais n'interprète pas leur sémantique.

### 3. Manuscrit et identité littéraire

Le manuscrit est un arbre ordonné de nœuds stables.

```ts
export type LiteraryNodeKind =
  | "manuscript"
  | "chapter"
  | "section"
  | "paragraph";

export type LiteraryNode = {
  id: string;
  kind: LiteraryNodeKind;
  title?: string;
  parentId?: string;
  contentRef?: ContentVersionRef;
  domainRefs: DomainEntityRef[];
  lineage: NodeLineage;
};
```

La hiérarchie est **typée mais flexible** : un chapitre peut contenir directement des paragraphes ; les quatre niveaux ne sont pas tous obligatoires dans chaque chemin. Leur granularité reste toutefois explicitement connue.

Le paragraphe est la plus petite identité persistante imposée par le Core. Une sélection plus fine utilise `nodeId + TextRange`; phrases et mots ne deviennent pas des entités persistantes par défaut.

### 4. Contenu versionné séparément

Une réécriture ne change pas l'identité littéraire du nœud.

```ts
export type ContentVersionRef = {
  nodeId: string;
  version: number;
};

export type ContentVersion = {
  nodeId: string;
  version: number;
  content: string;
  contentHash: string;
  createdAt: string;
  createdBy: ContributorRef;
};
```

Une version publiée/commise est immuable. Restaurer une ancienne version crée une nouvelle révision qui la référence ; aucune version historique n'est modifiée.

### 5. Lineage explicite

Le système ne déduit pas l'identité par similarité textuelle lorsqu'une opération structurelle est connue.

- `move` conserve `nodeId` ;
- `rewrite` conserve `nodeId` et crée une nouvelle `ContentVersion` ;
- `split` crée de nouveaux nœuds avec `derivedFrom` ;
- `merge` crée un nouveau nœud avec plusieurs `derivedFrom` ;
- suppression/archivage conserve la trace historique.

```ts
export type NodeLineage = {
  derivedFrom: string[];
  supersedes: string[];
};
```

Les détails de tombstone/purge physique restent une décision de persistance ultérieure ; l'historique logique ne doit pas disparaître.

### 6. Contributor, Role, Permission et Assignment sont orthogonaux

```ts
export type Contributor = {
  id: string;
  kind: "human" | "agent";
  displayName: string;
};
```

- `Contributor` = qui agit ;
- `Role` = fonction éditoriale (`author`, `editor`, `corrector`, `reviewer`, extensible) ;
- `Permission` = capacité effective ;
- `Assignment` = responsabilité sur une tâche ou un scope.

Un humain et un agent peuvent occuper le même rôle. Leur nature ne confère aucune permission implicite.

### 7. ContributionPolicy

Le Core doit permettre les deux régimes avec les mêmes primitives :

```ts
export type ContributionMode = "direct" | "propose";
```

La politique est évaluée pour un contributeur, un rôle, une opération et un scope.

- `direct` : le changement peut produire une révision dans l'espace de travail autorisé ;
- `propose` : le changement ne devient pas état canonique sans `Proposal + Review + Integration`.

La politique ne doit pas être codée comme `human => direct` ou `agent => propose`.

### 8. Scope commun

Les tâches, commentaires, changements et reviews utilisent une même adresse littéraire :

```ts
export type TextRange = {
  start: number;
  end: number;
};

export type LiteraryScope = {
  nodeId: string;
  range?: TextRange;
};
```

Le projet/manuscrit entier peut utiliser son nœud racine. Une sélection ne peut exister sans nœud parent stable.

### 9. Workspace et Variant

Le Core expose deux catégories de branche internes :

```ts
export type BranchKind = "workspace" | "variant";
```

- `workspace` : Version de travail temporaire, créée pour écrire ou accomplir une tâche ;
- `variant` : alternative volontairement conservée (hypothèse, structure, narration, argument, etc.).

Une expérimentation est modélisée comme une `variant` avec métadonnées, pas comme un troisième mécanisme de versioning.

Une tâche susceptible de modifier le manuscrit peut créer un workspace automatiquement. L'utilisateur n'a pas à comprendre ni créer une branche Git.

### 10. Revision DAG

```ts
export type Revision = {
  id: string;
  projectId: string;
  branchId: string;
  parentIds: string[];
  changeSetId: string;
  author: ContributorRef;
  createdAt: string;
  message?: string;
  provenanceRefs: DomainEntityRef[];
};
```

- une révision normale a un parent ;
- une révision d'intégration peut avoir plusieurs parents ;
- les révisions sont immuables ;
- une branche pointe vers une révision tête ;
- le Core n'utilise pas Git comme stockage canonique.

Git peut devenir un adaptateur d'import/export ultérieur.

### 11. ChangeSet sémantique

`ChangeSet` est le journal technique invisible des modifications d'une révision. Il ne doit pas devenir une surface utilisateur obligatoire.

Le minimum fonctionnel couvre :

```ts
type Change =
  | ReplaceContent
  | InsertNode
  | RemoveNode
  | MoveNode
  | SplitNode
  | MergeNodes
  | UpdateNodeMetadata;
```

Chaque changement contient :

- sa cible ;
- la version/révision de base attendue ;
- les données nécessaires à l'application ;
- le contributeur/provenance ;
- éventuellement un motif/intent lisible.

Les opérations doivent permettre un diff littéraire déterministe sans reconstruire l'intention depuis un diff de chaînes.

### 12. Task

Une `Task` organise le travail, elle ne représente pas le changement lui-même.

```ts
export type TaskStatus = "todo" | "in_progress" | "in_review" | "done";

export type Task = {
  id: string;
  scope: LiteraryScope;
  assigneeId: string;
  reviewerIds: string[];
  collaboratorIds: string[];
  status: TaskStatus;
  instruction: string;
};
```

Une tâche possède un assignee principal. Humain et agent utilisent le même contrat.

### 13. Proposal

Une `Proposal` est un paquet éditorial soumis à validation. Elle peut référencer tout ou partie des changements produits dans un ou plusieurs ChangeSets compatibles.

```ts
export type ProposalStatus =
  | "draft"
  | "submitted"
  | "changes_requested"
  | "approved"
  | "rejected"
  | "integrated"
  | "stale";
```

La proposition conserve :

- la révision/base depuis laquelle elle a été préparée ;
- les changements inclus ;
- l'auteur de la proposition ;
- le workspace/variant source ;
- les décisions de review ;
- commentaires et provenance.

Une `Proposal` n'est pas obligatoire pour une contribution `direct`.

### 14. Review et validation partielle

Une review porte sur la proposition et peut décider au niveau d'un changement.

```ts
export type ReviewDecision =
  | "accept"
  | "reject"
  | "request_changes"
  | "comment";
```

Le Core doit supporter :

- une décision par changement ;
- une décision appliquée à une sélection ;
- accepter/rejeter tout ;
- commenter sans décider ;
- conserver la discussion après résolution.

Une décision collective/globalisée est une projection pratique de décisions élémentaires, pas une perte de granularité.

### 15. Autorité éditoriale

En workflow éditorial :

- l'éditeur orchestre et assigne ;
- l'auteur reste autorité sur son texte ;
- l'éditeur intègre les changements validés ;
- un rejet auteur ne peut pas être transformé silencieusement en acceptation par l'éditeur.

Sans éditeur, un même contributeur peut porter `author + editor` et le workflow se contracte naturellement.

Les permissions doivent permettre d'autres politiques sans coder ces rôles en dur dans le moteur de versioning.

### 16. Integration

`Integration` applique uniquement les changements autorisés par les décisions courantes et crée une nouvelle révision du DAG.

Une intégration :

- vérifie la base et les conflits avant mutation ;
- exclut les changements rejetés ;
- conserve les liens vers proposition, review et provenance ;
- produit une révision à parents multiples lorsque nécessaire ;
- n'efface jamais la branche/variante historique par nécessité métier.

L'UI peut appeler ce geste **Intégrer au manuscrit** ; le domaine n'expose pas le vocabulaire Git `merge` aux utilisateurs.

### 17. Classes de conflit

```ts
export type ConflictKind =
  | "version"
  | "textual"
  | "structural"
  | "editorial";
```

- `version` : le changement repose sur une version devenue obsolète ;
- `textual` : deux changements incompatibles touchent le même contenu/plage ;
- `structural` : opérations incompatibles sur identité, parenté, ordre, split/merge/suppression ;
- `editorial` : modifications techniquement combinables mais incompatibles avec une décision humaine, une intention ou une contrainte métier signalée.

Le Core détecte les trois premières classes à partir de ses propres données. Le conflit `editorial` peut être déclaré par une policy, une review ou un consommateur métier ; le Core ne prétend pas comprendre seul la cohérence argumentative ou narrative.

### 18. Auto-réconciliation bornée

Une réconciliation peut être automatique uniquement si l'indépendance est démontrable, par exemple :

- nœuds distincts sans dépendance structurelle commune ;
- plages non chevauchantes dans une même version de base lorsque l'application reste déterministe ;
- changement de métadonnée indépendant d'un changement de contenu ;
- opérations structurelles sur sous-arbres distincts sans modification concurrente de leur ancêtre pertinent.

En cas de doute, le Core produit un conflit explicite. Il ne demande jamais à un LLM de décider silencieusement qu'un conflit est sans importance.

### 19. Stale proposals

Une proposition basée sur une révision qui n'est plus compatible devient `stale` mais reste historique.

Elle peut être :

- consultée ;
- comparée à sa base et au texte actuel ;
- adaptée en nouvelle proposition ;
- rejetée/archivée selon l'UX.

Elle ne peut jamais écraser automatiquement un contenu plus récent.

### 20. UX vocabulary contract

Le Core doit pouvoir alimenter une UI où les termes par défaut sont :

```text
workspace   -> Version de travail
variant     -> Variante
proposal    -> Proposition de révision
review      -> Validation / commentaires
integration -> Intégrer au manuscrit
stale       -> Le passage a changé depuis cette proposition
```

`branch`, `commit`, `pull request`, `merge`, `rebase` et `ChangeSet` restent des termes techniques internes ou développeur.

### 21. Persistence ports, not persistence choice

La spec définit des ports capables de :

- charger le manuscrit courant et une révision donnée ;
- résoudre une `ContentVersion` ;
- enregistrer de nouvelles versions de contenu ;
- append une révision et son ChangeSet ;
- déplacer atomiquement une tête de branche ;
- stocker tâches/propositions/reviews/intégrations ;
- parcourir parents et ancêtres ;
- matérialiser ou charger un snapshot.

Le choix PostgreSQL, fichiers, event store, object storage ou combinaison est hors de cette spec. L'implémentation ne doit pas nécessiter de rejouer tout l'historique pour lire l'état courant : snapshots/materialized state sont autorisés et attendus.

### 22. Shared-core extraction guard

Le Core ne réutilise pas directement une classe AutoEssay uniquement parce que son nom paraît générique.

Réutiliser en priorité les invariants prouvés :

- arbre canonique de manuscrit ;
- références de versions immuables ;
- références génériques `{kind,id}` ;
- provenance générique ;
- review non mutante.

Une primitive spécialisée n'entre dans le Core que si au moins deux consommateurs réels l'emploient avec la même sémantique.

## Core Invariants

1. Un `LiteraryNode.id` identifie la même entité littéraire à travers move/rename/rewrite.
2. Une `ContentVersion` historique est immuable.
3. Une révision historique est immuable.
4. Tout changement indique sa base attendue.
5. Une opération `split` ou `merge` possède un lineage explicite.
6. Un objet métier de Writing Engine n'est jamais requis pour ouvrir ou modifier un projet Core.
7. Humain/agent est orthogonal au rôle et aux permissions.
8. `direct | propose` provient d'une policy, pas d'un test sur le type de contributeur.
9. Une proposition ne devient jamais canonique sans une `Integration` autorisée.
10. Une proposition stale n'écrase jamais un état plus récent.
11. Les décisions rejetées et commentaires résolus restent auditables.
12. Une fusion techniquement possible ne vaut pas validation éditoriale.
13. Le Core ne promet jamais de résoudre automatiquement un conflit sémantique de domaine.
14. Le manuscrit canonique n'est ni Markdown, ni DOCX, ni LaTeX ; ces formats appartiennent aux adaptateurs ultérieurs.

## Principal Flows

### A. Écriture directe autorisée

```text
Contributor
  -> Workspace
  -> ChangeSet
  -> policy = direct
  -> Revision
  -> workspace head updated
```

Ce flux convient à l'auteur qui écrit ou à un Writing Engine autorisé à produire un brouillon.

### B. Correction soumise à validation

```text
Editor creates Task
  -> Corrector/Agent works in Workspace
  -> ChangeSets / Revisions
  -> Editor prepares Proposal
  -> Author Review
       accept/reject/comment per change
  -> Editor Integrates accepted changes
  -> canonical Revision
```

### C. Auteur sans éditeur

```text
Contributor roles = [author, editor]
  -> direct writing when policy permits
  -> optional Proposal for risky/batch changes
  -> self-review/integration when policy permits
```

Le Core n'impose pas des écrans supplémentaires lorsque les rôles se confondent.

### D. Variante conservée

```text
canonical Revision
   -> Variant
   -> independent revisions
   -> may remain forever
   -> optionally Proposal back to canonical manuscript
```

### E. Proposition devenue stale

```text
Proposal(base = R12)
canonical advances to R15
   -> conflict check
   -> stale
   -> compare base/current/proposed
   -> adapt into new Proposal OR keep current OR explicit integration if safely reconcilable
```

## Integration with AutoEssay and AutoFiction

Le Core doit être consommé comme dépendance de collaboration, pas comme super-domaine.

### AutoEssay

AutoEssay peut référencer :

```text
LiteraryNode paragraph P42
  <- DomainEntityRef claim:42
  <- DomainEntityRef evidence:17
```

Ses `Claim`, `EvidencePack`, citations, `ContentRelation`, décisions diffractives et évaluations restent dans AutoEssay.

### AutoFiction

AutoFiction peut référencer :

```text
LiteraryNode section S8
  <- DomainEntityRef scene:11
  <- DomainEntityRef character:anna
```

Ses scènes, personnages, canon, timeline, story state et règles narratives restent dans AutoFiction.

### Writing Engine actions

Un moteur métier produit soit :

- une commande/changement Core compatible avec ses permissions ;
- une `Proposal`/révision à examiner ;
- des `domainRefs` et provenance permettant de revenir à son raisonnement métier.

Le Core ne stocke ni chain-of-thought ni état interne de raisonnement.

## Testing Decisions

### Slice A — identity and versioning

Prouver que :

- move/rewrite gardent l'identité ;
- split/merge créent le lineage attendu ;
- les versions historiques restent immuables ;
- une restauration crée une nouvelle révision ;
- les parentIds forment le DAG attendu, y compris intégration multi-parent.

### Slice B — contribution policy

Prouver que :

- humain et agent peuvent recevoir la même tâche ;
- le même rôle peut être `direct` dans un scope et `propose` dans un autre ;
- une contribution `propose` ne peut pas modifier l'état canonique avant intégration ;
- la nature `human | agent` seule ne change jamais la décision de policy.

### Slice C — proposal/review/integration

Prouver que :

- une Proposal sélectionne un sous-ensemble de changements ;
- les décisions par changement sont conservées ;
- accept/reject global se projette correctement sur les changements ciblés ;
- seuls les changements acceptés sont intégrés ;
- commentaires et décisions restent accessibles après intégration.

### Slice D — stale/conflicts

Prouver les quatre classes de conflit et au minimum :

- remplacement concurrent du même paragraphe => conflit textuel/version ;
- déplacement et suppression du même nœud => conflit structurel ;
- changements sur nœuds indépendants => réconciliation sûre ;
- proposition sur ancienne ContentVersion => stale ;
- conflit éditorial déclaré bloque l'intégration même sans collision technique.

### Slice E — phase-agnostic consumers

Créer deux consommateurs de test minimaux, sans reprendre les domaines complets :

- consumer `essay` qui attache une `DomainEntityRef` de type claim ;
- consumer `fiction` qui attache une `DomainEntityRef` de type scene.

Les deux doivent pouvoir créer/réviser le même type de manuscrit Core sans dépendance croisée.

### Regression

L'introduction du Core ne doit pas casser les comportements AutoEssay existants. La migration d'un appelant existant vers les nouveaux contrats doit être un ticket séparé et tracer explicitement sa compatibilité.

## Acceptance Criteria

- [ ] Un projet Core peut être créé et utilisé sans importer un module AutoEssay/AutoFiction.
- [ ] Le manuscrit expose une hiérarchie typée flexible avec identité stable jusqu'au paragraphe.
- [ ] Le contenu et les révisions sont immuables une fois enregistrés.
- [ ] Le DAG supporte branches de travail, variantes et révisions d'intégration multi-parent.
- [ ] Le changement sémantique minimum couvre rewrite/insert/remove/move/split/merge/metadata.
- [ ] Humains et agents utilisent le même `Contributor`, `Task`, `Proposal` et `Review`.
- [ ] Rôle, permission et assignment sont distincts.
- [ ] `ContributionPolicy` supporte `direct | propose` indépendamment du type humain/agent.
- [ ] Une Proposal peut porter un sous-ensemble de changements et être validée partiellement.
- [ ] Une Integration n'applique que les changements autorisés et conserve la provenance.
- [ ] Les quatre catégories de conflit sont représentables et testées.
- [ ] L'auto-réconciliation est limitée aux cas d'indépendance prouvable.
- [ ] Une Proposal stale est conservée et ne peut pas écraser silencieusement une version récente.
- [ ] Les objets spécialisés sont attachés par `DomainEntityRef` sans entrer dans le modèle Core.
- [ ] Aucune décision de stockage concret, CRDT temps réel, Markdown canonique ou renderer de publication n'est nécessaire pour satisfaire la spec.

## Out of Scope

- collaboration synchrone / curseurs / présence / CRDT temps réel ;
- choix PostgreSQL, SQLite, event store ou object storage ;
- authentification, organisations, invitation d'utilisateurs et billing ;
- notifications externes ;
- design final de l'éditeur WYSIWYG ;
- DOCX round-trip, Markdown visible, EPUB, PDF, Typst, LaTeX, InDesign/IDML/ICML ;
- marketplace d'agents ;
- politiques autonomes complexes ou auto-merge sémantique par LLM ;
- migration intégrale immédiate d'AutoEssay ;
- implémentation des objets AutoFiction ;
- stockage ou exposition d'une chain-of-thought.

## Further Notes

Cette spec traduit le résultat Wayfinder #158 en contrats implémentables sans figer l'infrastructure. Le point central est que le Core n'est ni « Git pour écrivains » ni « workflow d'édition après écriture » : c'est le noyau collaboratif du **même manuscrit**, depuis sa création jusqu'à son édition.

Le vocabulaire utilisateur doit rester éditorial : Version de travail, Variante, Proposition de révision, Validation, Intégration. Les primitives inspirées de Git existent pour obtenir un historique robuste, pas pour imposer Git comme modèle mental.

Le chantier #165 (format canonique riche et publication professionnelle) est explicitement parqué. Sa reprise doit partir des invariants du Core et ne pas redéfinir identité, versioning ou collaboration.