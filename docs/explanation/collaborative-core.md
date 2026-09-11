# Collaborative Manuscript Core — intégration AutoEssay

## État

Le Collaborative Manuscript Core (CC1) est désormais implémenté dans `Orel-doudou-records/writing-engine` et validé par les tickets #21–#27 du dépôt Writing Engine.

Le Core partagé couvre :

- identité littéraire stable (`manuscript`, `chapter`, `section`, `paragraph`) ;
- versions de contenu immuables ;
- `ChangeSet` sémantiques et DAG de révisions ;
- `workspace` et `variant` ;
- contributeurs humains ou agents, rôles, permissions, tâches et `ContributionPolicy` ;
- `Proposal`, `Review`, validation partielle et `Integration` ;
- conflits, stale proposals et réconciliation bornée ;
- ports de persistance et snapshots matérialisés.

Deux fixtures indépendantes — essay-style et fiction-style — utilisent déjà les mêmes API publiques sans modification du code de production du Core. Cette preuve confirme la dépendance voulue :

```text
AutoEssay -> Collaborative Manuscript Core

Collaborative Manuscript Core -X-> Claim / Evidence / DraftUnit / ContentRelation / EditorialDecision
```

## Frontière AutoEssay

AutoEssay reste propriétaire de :

- `EssayProject` ;
- `DraftUnit` et de sa logique métier ;
- `Claim`, `Source`, `Evidence`, `Citation` ;
- `ContentRelation` ;
- décisions et évaluations argumentatives ;
- pipeline Writer/Judge ;
- persistance et API actuelles tant qu'une migration ultérieure n'est pas explicitement spécifiée.

Le Core peut transporter des liens vers ces objets sous forme de références génériques `{ kind, id }`, mais ne doit jamais interpréter leur sémantique.

## Première adoption : #168

Le tracer bullet de compatibilité #168 est implémenté par `src/editorial/writingEngineCollaborativeCoreAdapter.ts`.

AutoEssay épingle exactement Writing Engine au commit :

```text
36a3bcd04381890d3a4cd738832b1a278b786fb0
```

Le seam est **unidirectionnel et pur** :

```text
Manuscript + DraftUnit[]
        │
        └── projectAutoEssayManuscriptToCollaborativeCore(...)
                    │
                    ├── LiteraryManuscript
                    └── ContentVersion[]
```

Il ne modifie ni le manuscrit ni les `DraftUnit` reçus. Il ne remplace aucun chemin de production AutoEssay.

### Identité et contenu

- `Manuscript.id` devient l'identité racine CC1 ;
- les identités des nœuds structurels existants sont conservées ;
- lorsqu'un `ManuscriptLeaf` est relié à une `PlanEntry`, `PlanEntry.id` devient l'identité littéraire persistante du paragraphe et `(unitId, unitVersion)` reste relié via `contentRef.version` + une référence opaque vers le `DraftUnit` ;
- un `DraftUnit` autonome peut fournir l'identité littéraire de repli lorsqu'aucune `PlanEntry` ne la fournit ;
- le texte d'un `DraftUnit` est projeté en `ContentVersion` sans déplacer la classe `DraftUnit` dans Writing Engine.

Les références AutoEssay restent opaques pour CC1, par exemple :

```text
autoessay.draft-unit
autoessay.claim
autoessay.editorial-decision
autoessay.content-style-articulation
autoessay.transformation-trace
```

`toCollaborativeCoreScope(...)` permet de cibler un nœud ou une plage de texte avec le contrat `LiteraryScope` du Core.

### Limites explicites du tracer bullet

Le seam préfère échouer explicitement plutôt que produire une projection trompeuse.

Dans #168 :

- la projection structurelle prouvée est `manuscript -> chapter -> section -> paragraph`, avec niveaux sautables lorsque CC1 l'autorise ;
- une profondeur de nœuds structurels AutoEssay supérieure à `chapter -> section` n'est pas aplatie automatiquement ;
- un `ManuscriptNode.text` non vide n'est pas ignoré : il provoque une erreur car AutoEssay ne lui fournit pas encore une identité de contenu versionnée compatible ;
- une version de `DraftUnit` référencée mais absente de l'entrée de l'adaptateur provoque une erreur ;
- les `PlanEntry` encore sans texte restent, pour ce tracer bullet, dans le modèle AutoEssay : leur placement relatif avec les feuilles rédigées n'est pas inventé par l'adaptateur ;
- si plusieurs occurrences ne peuvent pas recevoir une identité littéraire stable et non ambiguë, la projection doit être refusée plutôt que fabriquer une identité dépendante de la version.

Ces limites servent à identifier les prochains besoins réels avant toute extension du modèle partagé.

## Ce que #168 ne change pas

Le tracer bullet ne :

- remplace pas le manuscrit AutoEssay canonique ;
- modifie pas la persistance existante ;
- introduit pas de dual-write ;
- bascule pas Writer, importer, RevisionProposal, API ou UI vers CC1 ;
- crée pas de base de données ni de nouvelle couche générique.

## Règle d'adoption

Le chemin retenu est **compatibility-first** :

```text
modèle AutoEssay existant
        │
        ├── reste canonique
        │
        └── projection pure
                │
                ▼
      Collaborative Manuscript Core
                │
                ▼
          tests de parité
```

Une future bascule de responsabilité ne pourra être décidée qu'après preuve sur un consommateur réel et fera l'objet d'une spécification/tickets séparés.
