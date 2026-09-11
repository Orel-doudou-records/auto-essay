# CC1-AE2 — First Production Authority Cutover

## Status

Ready for ticketing. Derived from Wayfinder #170 and locked decisions #171–#173.

## Problem Statement

CC1 est désormais disponible dans `writing-engine` et AutoEssay possède déjà un tracer bullet de compatibilité qui projette son manuscrit, ses identités littéraires et ses versions de contenu vers les contrats du Collaborative Manuscript Core.

Cette compatibilité reste cependant en lecture seule : le flux de production réel continue à utiliser `DraftUnit`, `RevisionProposal`, `revision-proposals.json` et une application directe depuis l'UI. `revise-chat` génère un candidat sans modifier le manuscrit, puis l'éditeur applique ce texte par un `update(content, version + 1)` après un contrôle d'obsolescence local fondé sur `proposal.before`.

Ce fonctionnement ne fournit pas encore les garanties pour lesquelles CC1 a été construit : historique de travail, base explicite, branche de travail, détection d'obsolescence, review, intégration autorisée et provenance durable.

AE2 doit donc effectuer le **premier transfert réel d'autorité de production** vers CC1, sans migrer tout AutoEssay et sans déplacer sa sémantique essayistique dans Writing Engine.

## Solution

Migrer uniquement la **révision explicite d'un paragraphe montée dans le manuscrit et déclenchée par `revise-chat`**.

Pour ce seam :

1. AutoEssay reste propriétaire de la préparation du prompt, des sources, du `RevisionBrief`, du Writer/Judge et de la génération du texte candidat.
2. Une fois le candidat produit et sa base revalidée, CC1 devient propriétaire de l'état de travail : `workspace`, `ChangeSet`, `Revision` et historique.
3. Une action auteur transforme la Version de travail en `Proposal`, puis en `Review` acceptée ou rejetée.
4. CC1 évalue stale/conflits contre sa branche canonique.
5. Une `Integration` CC1 autorisée est l'unique événement qui peut matérialiser une nouvelle version canonique AutoEssay.
6. La matérialisation met à jour le `DraftUnit`, la ou les références de version dans le manuscrit AutoEssay, puis conserve une provenance vers l'Integration CC1.
7. Le vieux `RevisionProposal` n'est plus écrit pour ce seam.

```text
AutoEssay revision semantics
RevisionBrief / revise-chat / sources / LLM
                  │
                  ▼
           candidate text
                  │
          revalidate base
                  │
                  ▼
        CC1 working branch
      ChangeSet + Revision DAG
                  │
            author action
                  │
                  ▼
        Proposal + Review
                  │
         stale/conflicts
                  │
                  ▼
          CC1 Integration
                  │
                  ▼
  AutoEssay canonical materialization
 DraftUnit vN+1 + manuscript reference
       + integration provenance
```

### Central invariant

> **Une seule autorité par état : CC1 possède le travail en cours et son histoire ; AutoEssay possède la sémantique essayistique et le contenu canonique courant jusqu'à `Integration`. `Integration` est la seule frontière qui matérialise une nouvelle version canonique AutoEssay.**

## User Stories

1. En tant qu'auteur, je peux demander une révision IA d'un paragraphe sans que mon texte canonique change automatiquement.
2. En tant qu'auteur, je peux comparer le texte de départ et le texte proposé comme aujourd'hui.
3. En tant qu'auteur, je peux modifier localement le texte proposé avant de l'appliquer ; cette modification devient une Revision CC1 avant validation, pas une écriture directe dans `DraftUnit`.
4. En tant qu'auteur, je peux refuser une proposition et conserver une trace de ce refus sans modifier le manuscrit.
5. En tant qu'auteur, si le paragraphe a changé depuis la préparation de la proposition, l'application est bloquée par le backend et non seulement par l'UI.
6. En tant que mainteneur, je peux voir quelle Revision/Integration CC1 a produit une version canonique AutoEssay.
7. En tant que mainteneur, je peux continuer à utiliser l'autosave manuel, Writer/Judge et les autres workflows non migrés sans les faire passer artificiellement par CC1.
8. En tant que futur consommateur du Core, je peux remplacer progressivement les autres seams AutoEssay sans réécrire le modèle de collaboration.

## Implementation Decisions

### 1. Portée exacte du cutover

AE2 migre un flux uniquement lorsque toutes les conditions suivantes sont vraies :

- la cible est un `DraftUnit` de granularité `paragraph` ;
- ce `DraftUnit` est monté dans le manuscrit AutoEssay courant ;
- le bridge #168 peut résoudre exactement une identité `LiteraryNode` stable pour ce `DraftUnit` ;
- le nœud projeté est de type `paragraph`.

Les unités section/chapter/book et les paragraphes non montés restent sur le comportement legacy dans AE2. Un même acte de révision ne doit jamais écrire à la fois dans le chemin legacy et le chemin CC1.

Le dispatch doit être explicite et testable, par exemple via un service pur :

```ts
export type RevisionAuthority = "legacy" | "collaborative-core";

export function resolveRevisionAuthority(input: {
  unit: DraftUnit;
  literaryNodeId?: string;
}): RevisionAuthority;
```

Aucun feature flag global n'est requis pour le MVP ; la portée elle-même constitue la frontière de migration.

### 2. Un projet CC1 par projet AutoEssay

Le paragraphe est la portée du premier cutover, **pas** une unité de stockage CC1.

Chaque projet AutoEssay possède au plus un état CC1 associé :

```ts
export type AutoEssayCollaborativeProjectLink = {
  autoEssayProjectId: string;
  coreProjectId: string;
  canonicalBranchId: string;
};
```

Pour AE2, `coreProjectId` peut être déterministe à partir du `projectId` AutoEssay ; aucune table d'identité globale n'est nécessaire.

La branche canonique CC1 représente la projection collaborative du manuscrit de référence. Les révisions candidates utilisent des branches `workspace` non canoniques.

### 3. Bootstrap paresseux depuis le bridge #168

Le premier `revise-chat` éligible d'un projet initialise CC1 si aucun état persistant n'existe encore.

Le bootstrap utilise exclusivement le seam existant :

```ts
projectAutoEssayManuscriptToCollaborativeCore({
  manuscript,
  draftUnits,
  contentCreatedBy: { id: "autoessay-canonical" },
});
```

Il crée :

- le `LiteraryManuscript` initial ;
- ses `ContentVersion` initiales ;
- un `RevisionGraph` avec branche canonique ;
- un snapshot initial ;
- les liens de projection nécessaires au bridge.

Le bootstrap ne modifie ni `DraftUnit`, ni `EditorialWorkspace`, ni le manuscrit AutoEssay.

Si la projection #168 échoue, AE2 ne fabrique pas d'identité de secours : le flux reste legacy ou retourne une erreur de compatibilité selon la condition d'éligibilité.

### 4. `DraftUnit.version` et `ContentVersion.version` ne partagent pas durablement la même horloge

Le tracer bullet #168 peut initialiser `ContentVersion.version` avec la version courante du `DraftUnit`. Cette égalité est une commodité de bootstrap, **pas un invariant de production**.

L'autosave AutoEssay existant peut aujourd'hui modifier `DraftUnit.content` sans incrémenter `DraftUnit.version`. CC1 doit conserver l'immutabilité de ses `ContentVersion` et ne peut donc pas réutiliser le même numéro lorsqu'un texte AutoEssay externe a changé.

Le bridge stocke un fingerprint explicite :

```ts
export type AutoEssayCanonicalFingerprint = {
  unitId: string;
  unitVersion: number;
  contentHash: string;
};

export type CanonicalProjectionLink = {
  literaryNodeId: string;
  autoEssay: AutoEssayCanonicalFingerprint;
  coreContentVersion: ContentVersionRef;
  coreRevisionId: string;
};
```

Après le bootstrap, CC1 incrémente ses propres `ContentVersion.version`. AutoEssay continue à gérer son numéro `DraftUnit.version`. Le bridge relie les deux ; il ne suppose plus leur égalité.

### 5. Synchronisation du canon externe avant création ou intégration d'une Version de travail

Pendant AE2, plusieurs chemins non migrés peuvent encore modifier le canon AutoEssay. Pour que CC1 reste l'autorité du stale/conflict sur le seam migré, le bridge doit d'abord projeter ces changements externes dans la branche canonique CC1.

Avant :

- de créer une nouvelle Version de travail `revise-chat` ;
- d'accepter/intégrer une Version de travail existante ;

le service exécute sous `projectWriteLock` une synchronisation bornée du nœud cible.

#### Synchronisation contenu

Si l'identité littéraire est inchangée mais le fingerprint AutoEssay diffère du dernier `CanonicalProjectionLink`, le bridge crée sur la branche canonique CC1 un `replace_content` avec provenance explicite, par exemple :

```ts
{ kind: "autoessay.canonical-sync", id: `${unitId}:${unitVersion}:${contentHash}` }
```

Le nouveau `ContentVersionRef` CC1 est enregistré dans le lien de projection.

Cette Revision est une **projection d'un changement canonique externe**, pas une validation collaborative rétroactive.

#### Synchronisation structurelle minimale

Si le même `LiteraryNode.id` existe toujours mais son parent/position a changé, le bridge peut projeter un `move_node` afin que CC1 puisse classer correctement un conflit structurel.

Si la cible a disparu, elle peut être projetée comme suppression logique lorsque cette correspondance est non ambiguë.

Toute dérive nécessitant d'inférer un `split`, `merge`, changement d'identité ou lineage non représenté par AutoEssay doit échouer avec un résultat `unsupported_projection_drift`. AE2 ne devine jamais un lineage par similarité textuelle.

### 6. Création d'une Version de travail depuis `revise-chat`

Le LLM ne doit pas tenir `projectWriteLock` pendant sa génération.

Le flux est :

1. lire le `DraftUnit` source ;
2. capturer `unitId`, `unitVersion`, `contentHash` et texte source ;
3. générer le candidat avec le pipeline `reviseChatService` existant ;
4. acquérir `projectWriteLock` ;
5. relire le `DraftUnit` ;
6. si son fingerprint diffère de la base capturée, ne créer aucun worktree/proposal et retourner `candidate_stale_before_workspace` ;
7. bootstrap/synchroniser CC1 si nécessaire ;
8. créer une branche `workspace` depuis la tête canonique courante ;
9. y committer un `ChangeSet` contenant un `replace_content` du paragraphe ;
10. persister Revision, ChangeSet, ContentVersion, branche et snapshot via les ports CC1.

La Revision créée par l'agent porte au minimum :

```ts
provenanceRefs: [
  { kind: "autoessay.revise-chat", id: revisionWorkId },
  { kind: "autoessay.draft-unit", id: unitId },
]
```

AE2 utilise des identités de contributeur déterministes adaptées au produit, sans introduire un système d'authentification :

- `{ id: "autoessay:revision-agent" }` pour le candidat généré ;
- `{ id: "autoessay:author" }` pour les actions explicites de validation/modification de l'utilisateur.

Ces IDs sont des références de provenance temporaires, pas un substitut à une future identité utilisateur.

### 7. Le candidat est une Version de travail avant d'être une Proposal

Le terme utilisateur « proposition de révision » n'oblige pas à créer immédiatement un objet `Proposal` CC1.

`revise-chat` crée d'abord un **état de travail persisté**. Cela permet de conserver le geste produit actuel où l'auteur peut modifier le texte proposé avant application.

DTO minimal :

```ts
export type CollaborativeRevisionWorkDto = {
  id: string;
  unitId: string;
  literaryNodeId: string;
  workspaceId: string;
  baseRevisionId: string;
  headRevisionId: string;
  base: AutoEssayCanonicalFingerprint & { content: string };
  proposedContent: string;
  status: "working" | "stale" | "rejected" | "integrated";
  proposalId?: string;
  integrationId?: string;
};
```

L'API ne renvoie plus un `RevisionProposal` domaine comme source de vérité pour le seam migré.

### 8. Modification auteur du texte proposé

Le `Textarea` actuel peut continuer à être éditable.

Au moment d'une action `accept`, si le texte soumis par l'UI diffère du contenu à la tête de la workspace :

- créer un nouveau `replace_content` sur **la même workspace** ;
- l'auteur `{ id: "autoessay:author" }` devient l'auteur de cette Revision ;
- le texte modifié devient la nouvelle tête de la Version de travail ;
- seulement ensuite créer la `Proposal` CC1.

Le texte modifié ne doit jamais être passé directement à `updateUnit`.

AE2 n'exige pas de persister chaque frappe dans CC1 : les modifications locales restent éphémères jusqu'à l'action explicite de l'auteur, comme dans l'UI actuelle.

### 9. Proposal et Review

Lors d'une action explicite de l'auteur, le backend construit la `Proposal` depuis la tête courante de la workspace.

Pour `accept` :

1. créer la Proposal avec les ChangeSets pertinents de la workspace ;
2. la soumettre ;
3. enregistrer une `ReviewDecision` autorisée `accept` pour tous ses items ;
4. évaluer l'intégration via le chemin conflict-aware de CC1 ;
5. intégrer uniquement si aucun conflit bloquant n'existe.

Pour `reject` :

1. créer/soumettre la Proposal depuis la workspace courante si aucune Proposal n'existe ;
2. enregistrer une `ReviewDecision` autorisée `reject` sur tous ses items ;
3. conserver workspace, revisions, proposal et review ;
4. ne produire aucune Integration et ne modifier aucun `DraftUnit`.

Le bridge ne crée pas de workflow artificiel où l'auteur devrait approuver séparément sa propre action dans cette première UX. Les objets Proposal/Review restent néanmoins explicites et auditables.

### 10. Stale et conflits

Le test UI `manuscript !== proposal.before` devient une indication visuelle seulement. Il ne décide plus de l'intégrabilité.

Avant intégration :

1. synchroniser le canon AutoEssay externe vers la branche canonique CC1 ;
2. appeler l'évaluation de conflits CC1 ;
3. si la base Proposal n'est plus la tête canonique, CC1 produit un état stale/version ;
4. deux `replace_content` concurrents sur le même paragraphe produisent un conflit `textual` bloquant ;
5. une opération structurelle concurrente sur la même identité produit un conflit `structural` ;
6. un conflit argumentatif explicitement détecté par AutoEssay peut être transmis à CC1 comme `editorial`, mais CC1 ne l'infère pas.

AE2 ne tente pas automatiquement `adaptStaleProposal` dans l'UX initiale. Une proposition stale reste consultable et bloquée. L'adaptation/rebase utilisateur sera un chantier ultérieur.

### 11. `Integration` est l'unique frontière canonique

Aucune Revision de workspace ne modifie `DraftUnit`.

Une Integration autorisée doit produire exactement une matérialisation AutoEssay pour le paragraphe ciblé :

```ts
DraftUnit {
  ...current,
  content: integratedContent,
  version: current.version + 1,
  updatedAt: now,
}
```

Le bridge met également à jour toutes les références canoniques attendues vers ce `DraftUnit` :

- `ManuscriptLeaf.version` ;
- le `PlanEntry.unitVersion` lié au même paragraphe lorsqu'il existe.

Une helper pure doit vérifier que la transition est non ambiguë :

```ts
advanceManuscriptUnitVersion(
  manuscript,
  unitId,
  expectedVersion,
  nextVersion
)
```

Elle échoue plutôt que de modifier silencieusement plusieurs identités incompatibles.

Après matérialisation, le `CanonicalProjectionLink` pointe vers :

- le nouveau fingerprint AutoEssay ;
- le `ContentVersionRef` issu de l'Integration ;
- la Revision canonique CC1 créée par l'Integration.

### 12. Persistance CC1 fichier

AE2 implémente `CollaborativeCoreStore` pour le backend fichier AutoEssay.

Le stockage CC1 doit rester physiquement séparé de `editorial-workspace.json` et de `revision-proposals.json`, sous un namespace dédié, par exemple :

```text
<dataDir>/<projectId>/collaborative-core/
```

Le layout exact des fichiers n'est pas un contrat public. Le store doit cependant satisfaire les ports CC1 utilisés par AE2 :

- initialisation projet ;
- RevisionGraph / Revision / ChangeSet ;
- ContentVersion ;
- branches et CAS de tête ;
- snapshots ;
- Proposal / ReviewDecision / Integration ;
- liens de projection AutoEssay ↔ CC1 ;
- receipts de matérialisation décrits ci-dessous.

Aucune base de données, event store ou repository abstraction générique n'est introduit.

### 13. Sérialisation et cohérence inter-fichiers

`projectWriteLock` est un verrou **in-process** ; il sérialise les écritures concurrentes dans le processus mais ne fournit pas une transaction ACID multi-fichiers ni une garantie de crash atomique.

AE2 ne doit pas prétendre le contraire.

Toutes les mutations CC1 et AutoEssay du seam utilisent le même `projectWriteLock`. Les helpers `*WhileLocked` sont utilisées ou ajoutées pour éviter les verrous imbriqués.

Pour la matérialisation d'une Integration, AE2 ajoute un petit journal de bridge idempotent :

```ts
export type IntegrationMaterializationReceipt = {
  id: string;
  projectId: string;
  proposalId: string;
  integrationId: string;
  coreRevisionId: string;
  unitId: string;
  expectedSource: AutoEssayCanonicalFingerprint;
  targetVersion: number;
  targetContentHash: string;
  status: "prepared" | "core_integrated" | "applied";
  createdAt: string;
  appliedAt?: string;
};
```

#### Ordre de commit

Sous `projectWriteLock` :

1. revalider le fingerprint canonique AutoEssay ;
2. calculer l'Integration et la matérialisation attendue sans side effect ;
3. persister un receipt `prepared` avec IDs déterministes pour cette tentative ;
4. persister le résultat CC1 (review/proposal/integration/revision/snapshot) et passer le receipt à `core_integrated` ;
5. écrire le nouveau `DraftUnit` et le manuscrit AutoEssay avec la stratégie de rollback déjà utilisée par les imports ;
6. mettre à jour le `CanonicalProjectionLink` ;
7. passer le receipt à `applied`.

#### Recovery

Avant toute nouvelle commande AE2 mutante sur le projet, le bridge vérifie les receipts non `applied` :

- `prepared` sans Integration durable : reprendre ou annuler proprement la tentative avant toute autre mutation ;
- `core_integrated` avec ancien `DraftUnit` : terminer la matérialisation si le fingerprint source attendu est toujours présent ;
- `core_integrated` avec contenu/version cible déjà présents : marquer `applied` ;
- toute divergence non réconciliable : bloquer le seam avec une erreur de recovery explicite, sans écrasement silencieux.

Le but est une **atomicité logique récupérable**, adaptée au backend fichier, pas une fausse transaction distribuée.

### 14. API / commands

Le service applicatif expose trois commandes principales :

```ts
createCollaborativeParagraphRevision(input): Promise<CollaborativeRevisionWorkDto>
acceptCollaborativeParagraphRevision(input): Promise<CollaborativeRevisionResult>
rejectCollaborativeParagraphRevision(input): Promise<CollaborativeRevisionResult>
```

`createCollaborativeParagraphRevision` est appelée par les variantes standard et streaming de `revise-chat` après génération complète du candidat.

Les routes existantes de génération sont conservées :

```text
POST /api/projects/:projectId/units/:unitId/revise-chat
POST /api/projects/:projectId/units/:unitId/revise-chat/stream
```

Pour le seam CC1, elles retournent le DTO de Version de travail plutôt que le vieux `RevisionProposal`.

Les actions de validation deviennent des endpoints backend explicites :

```text
POST /api/projects/:projectId/units/:unitId/revision-work/:workId/accept
POST /api/projects/:projectId/units/:unitId/revision-work/:workId/reject
```

Payload `accept` minimal :

```ts
{ content: string }
```

Le champ permet de capturer l'éventuelle modification auteur du texte proposé avant application.

Le backend vérifie que `workId`, `unitId` et `projectId` désignent le même scope ; l'UI ne peut pas réutiliser une workspace sur un autre paragraphe.

### 15. DTO public et vocabulaire

Le frontend peut continuer à afficher :

- « Proposition de révision » ;
- texte proposé ;
- comparaison avec le texte de départ ;
- « Appliquer » / « Refuser » ;
- « Proposition périmée ».

Les termes `branch`, `ChangeSet`, `Revision DAG`, `merge` ou `rebase` ne sont pas exposés dans l'interface auteur.

Le type domaine historique `RevisionProposal` peut rester exporté pour compatibilité pendant AE2, mais il ne doit plus être utilisé comme type de persistance ni comme autorité du flux migré.

### 16. Déclencheurs post-intégration

L'Integration qui modifie effectivement `DraftUnit.content` doit préserver les effets produit existants du changement de texte.

Après matérialisation réussie :

- le nouveau texte est visible par les routes `units` et `manuscript-navigation` ;
- la référence de version du manuscrit correspond au nouveau `DraftUnit.version` ;
- l'automatic diffractive reading `text_changed` est planifiée comme pour une modification de contenu existante, si le paragraphe est rattaché à une section ;
- aucun trigger ne part avant que la matérialisation soit `applied`.

La planification asynchrone ne fait pas partie de la transaction de matérialisation ; un échec de scheduling ne doit pas annuler une Integration déjà appliquée. Le comportement de retry du scheduler reste celui d'AutoEssay.

## Authority Matrix

| État / décision | Autorité AE2 |
| --- | --- |
| Instruction de révision, sources, prompt, contraintes essayistiques | AutoEssay |
| Génération du texte candidat | AutoEssay / LLM runtime |
| Identité littéraire cible | Bridge #168 + CC1 |
| Version de travail candidate | CC1 |
| Historique des modifications de la Version de travail | CC1 |
| Proposal / Review / Integration | CC1 |
| Stale/version/textual/structural conflict du seam | CC1 après synchronisation du canon externe |
| Signal de conflit argumentatif/essayistique | AutoEssay, déclaré à CC1 comme `editorial` |
| Canon courant avant Integration | AutoEssay |
| Décision explicite auteur accept/reject | action produit traduite en Review CC1 autorisée |
| Matérialisation `DraftUnit vN+1` | bridge AutoEssay déclenché uniquement par Integration CC1 |
| `EditorialWorkspace` sémantique | AutoEssay |
| Ancien `RevisionProposal` des flux legacy | AutoEssay legacy uniquement |

## State Flows

### Happy path

```text
DraftUnit v3
   │
   ├─ revise-chat generates candidate
   │
   ├─ source fingerprint revalidated
   │
   ▼
CC1 workspace @ canonical R10
   │
   ├─ R11 agent replace_content
   │
   ├─ optional R12 author replace_content
   │
   ▼
Proposal P1 submitted
   │
   ▼
Review accept
   │
   ▼
conflict assessment clean
   │
   ▼
Integration I1 -> canonical R13
   │
   ▼
materialization receipt
   │
   ▼
DraftUnit v4 + manuscript unitVersion=4
```

### Canon changed while LLM was generating

```text
capture DraftUnit fingerprint A
   │
   ├─ LLM runs
   │
   ├─ autosave changes canonical -> fingerprint B
   │
   ▼
post-generation revalidation
   │
   └─ A != B -> candidate_stale_before_workspace
                  no CC1 workspace created
```

### Canon changed after workspace creation

```text
workspace/proposal based on canonical R10
   │
   ├─ legacy/manual canonical change
   │
   ▼
accept command
   │
   ├─ bridge sync -> canonical R12
   │
   ├─ CC1 assessment: base R10 != R12
   │
   └─ stale/textual conflict -> no Integration
```

## Persistence and Compatibility

### Legacy `revision-proposals.json`

AE2 n'effectue aucune migration globale du fichier existant.

- les entrées historiques restent lisibles ;
- les flux non éligibles peuvent continuer à l'utiliser temporairement ;
- les nouveaux `revise-chat` éligibles CC1 n'y écrivent jamais ;
- il n'existe aucun dual-write d'une même proposition dans les deux systèmes.

### `editorial-workspace.json`

Il reste le store sémantique AutoEssay : manuscrit, distribution, profils, articulations, décisions, lectures, diffraction.

Il ne stocke ni RevisionGraph, ni Proposal CC1, ni workspaces CC1.

La matérialisation d'une Integration ne modifie dans cet agrégat que la structure/référence de version du manuscrit nécessaire pour pointer vers le nouveau `DraftUnit`.

### Dependency direction

```text
AutoEssay domain + API
        │
        ├── #168 compatibility projection
        │
        ▼
Writing Engine / Collaborative Core
```

Writing Engine ne dépend jamais d'AutoEssay.

## Testing Requirements

### Slice A — authority dispatch

- paragraphe monté + identité #168 unique -> `collaborative-core` ;
- section/chapter -> `legacy` ;
- paragraphe non monté ou ambigu -> pas de CC1 silencieux ;
- aucune requête ne produit à la fois old `RevisionProposal` et CC1 work state.

### Slice B — bootstrap and projection link

- premier revise-chat initialise un projet CC1 depuis le manuscrit courant ;
- IDs littéraires #168 sont conservés ;
- fingerprint AutoEssay initial est relié au `ContentVersionRef` ;
- aucun objet Claim/Evidence/EditorialDecision n'entre comme primitive CC1.

### Slice C — candidate creation

- génération réussie -> workspace + replace_content revision persistées ;
- `DraftUnit` reste inchangé ;
- changement du source pendant la génération -> `candidate_stale_before_workspace` et zéro workspace ;
- variante streaming ne persiste qu'au `done` final.

### Slice D — author edit

- auteur applique le candidat sans modification -> pas de Revision auteur supplémentaire ;
- auteur modifie le `Textarea` avant accept -> nouvelle Revision sur la même workspace ;
- aucune modification locale n'écrit directement `DraftUnit`.

### Slice E — review and reject

- accept crée Proposal soumise + Review accept autorisée ;
- reject crée/conserve Proposal + Review reject ;
- reject ne modifie ni `DraftUnit`, ni manuscrit canonique ;
- historique de workspace reste consultable.

### Slice F — stale/conflicts

- autosave externe change le contenu sans bump de `DraftUnit.version` -> hash différent, sync CC1, proposition stale/textual ;
- version AutoEssay avance -> sync CC1 puis stale ;
- move/suppression simple du même literary node -> conflit structurel ou blocage sûr ;
- dérive structurelle non représentable -> `unsupported_projection_drift`, jamais de merge implicite.

### Slice G — integration materialization

- Integration propre -> exactement `DraftUnit.version + 1` ;
- `ManuscriptLeaf.version` et `PlanEntry.unitVersion` avancent ensemble ;
- provenance Integration ↔ matérialisation est récupérable ;
- trigger `text_changed` part après succès ;
- double appel accept est idempotent et ne crée pas vN+2.

### Slice H — recovery

- crash simulé après receipt `prepared` -> reprise sans double Integration ;
- crash simulé après `core_integrated` -> DraftUnit matérialisé une seule fois ;
- DraftUnit déjà au contenu/version cible -> recovery marque `applied` ;
- divergence inattendue -> blocage explicite, aucun écrasement.

### Slice I — regression

- autosave manuel hors seam continue de fonctionner ;
- Writer/Judge reste inchangé ;
- ContentStyleArticulation / EditorialDecision restent inchangés ;
- imports/reimports existants restent verts ;
- tests #168 restent verts ;
- API/web/core full CI reste verte.

## Acceptance Criteria

- [ ] Un `revise-chat` éligible crée une Version de travail CC1 et n'écrit pas `revision-proposals.json`.
- [ ] La génération du candidat ne modifie jamais le `DraftUnit` canonique.
- [ ] La base du candidat est revalidée après le LLM avant création de la workspace.
- [ ] Un projet CC1 est initialisé paresseusement à partir du bridge #168.
- [ ] AutoEssay et CC1 utilisent des horloges de version distinctes après bootstrap, reliées par fingerprint + `CanonicalProjectionLink`.
- [ ] Une modification canonique legacy est synchronisée vers la branche canonique CC1 avant création/intégration d'un work state.
- [ ] Le texte proposé peut être modifié par l'auteur sans écriture directe dans `DraftUnit`.
- [ ] Accept/reject produisent des ReviewDecision CC1 autorisées.
- [ ] Stale et conflits du seam sont décidés côté backend CC1, pas par le test `proposal.before` de l'UI.
- [ ] Seule une Integration CC1 propre peut matérialiser un nouveau `DraftUnit`.
- [ ] La matérialisation avance `DraftUnit.version`, `ManuscriptLeaf.version` et `PlanEntry.unitVersion` de façon cohérente.
- [ ] Une Integration matérialisée conserve une provenance durable vers CC1.
- [ ] Les écritures du seam utilisent `projectWriteLock` sans lock imbriqué.
- [ ] Un journal de matérialisation rend le commit inter-fichiers idempotent et récupérable.
- [ ] Un appel accept répété ne produit jamais deux versions AutoEssay.
- [ ] L'ancien `RevisionProposal` reste legacy uniquement ; aucun dual-write du seam migré.
- [ ] `EditorialWorkspace` n'est pas réutilisé comme workspace CC1.
- [ ] Les flux non visés par AE2 restent behavior-preserving.
- [ ] Tous les tests existants et les nouveaux tests AE2 sont verts.

## Rollout / Implementation Order

La réalisation doit être ticketée en tranches verticales petites et réversibles :

1. **File store + project bootstrap** — adapter `CollaborativeCoreStore`, liens de projection, tests de persistance.
2. **Canonical sync** — fingerprint, synchronisation contenu/structure minimale, stale foundation.
3. **revise-chat work state cutover** — standard + streaming, sans Proposal encore si nécessaire pour garder la tranche petite.
4. **Proposal/review API** — accept/reject et capture d'une modification auteur.
5. **Integration materialization** — DraftUnit + manuscript refs + provenance + journal/recovery.
6. **Frontend cutover** — DTO Revision Work, backend accept/reject, stale autoritatif backend.
7. **Regression/hardening** — idempotence, crash simulation, triggers et CI complète.

Chaque ticket doit pouvoir être fusionné sans basculer un flux incomplet en production. Si un ticket introduit seulement l'infrastructure d'un futur cutover, le dispatch doit rester sur le chemin legacy jusqu'au ticket qui livre la tranche verticale complète correspondante.

## Out of Scope

- migration de l'autosave manuel vers CC1 ;
- migration Writer/Judge ;
- workspaces section/chapter ;
- révisions structurelles initiées par CC1 ;
- adaptation automatique d'une Proposal stale ;
- collaborative cursors / CRDT temps réel ;
- authentification et comptes multi-utilisateurs ;
- rôles UI complets éditeur/correcteur/relecteur ;
- migration globale de `revision-proposals.json` ;
- nouvelle base SQL/document/event store ;
- remplacement de `DraftUnit` par `ContentVersion` ;
- déplacement de `RevisionBrief`, Claim, Evidence, Citation, ContentRelation ou EditorialDecision vers Writing Engine ;
- refonte générale de l'éditeur ;
- publication/rendu final (#165 reste parqué).

## Handoff

Cette spec est prête pour `/to-tickets`.

Les tickets doivent préserver la séparation suivante :

> **AutoEssay explique pourquoi et comment réviser ; CC1 gouverne l'état de travail, sa validation et son intégration ; le bridge matérialise seulement une Integration validée dans le canon AutoEssay.**
