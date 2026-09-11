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

`auto-essay#168` est un **tracer bullet de compatibilité**, pas une migration.

Il doit uniquement :

1. épingler AutoEssay sur le commit exact de Writing Engine contenant CC1 ;
2. ajouter un adaptateur pur `AutoEssay manuscript -> Collaborative Manuscript Core` ;
3. conserver les identités de nœuds existantes ;
4. préserver hiérarchie et ordre ;
5. projeter les références de contenu/version existantes sans promouvoir `DraftUnit` en type partagé ;
6. transporter la provenance et les références métier via les contrats génériques CC1 ;
7. prouver la parité par tests.

Il ne doit pas :

- remplacer le manuscrit AutoEssay canonique ;
- modifier la persistance existante ;
- introduire de dual-write ;
- basculer Writer, importer, RevisionProposal, API ou UI vers CC1 ;
- créer une base de données ou une nouvelle couche générique.

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
