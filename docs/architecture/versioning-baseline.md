# Référence de versionnement : état initial

Ce document décrit le comportement observé du registre de fichiers avant toute
évolution de versionnement. Les contrats exécutables complémentaires sont dans
[`tests/registryContract.test.ts`](../../tests/registryContract.test.ts).

## Fichiers produits par `FileRegistry`

`FileRegistry` dans [`src/state/registry.ts`](../../src/state/registry.ts)
produit deux catégories de fichiers sous son `basePath` :

- `<basePath>/<projectId>/units/<unitId>_v<version>.json` est la sérialisation
  JSON complète d'une `DraftUnit` : `getUnitPath` construit seulement son
  chemin et `publishVersion` effectue l'écriture.
- `<basePath>/<projectId>/registry.json` est l'index, écrit par `saveRegistry`.
  Il associe chaque `unitId` à une liste ordonnée de `VersionEntry`
  (`version`, `unitId`, `publishedAt`, `manifest`, `contentHash`).

`getLatest` consulte la dernière entrée de cet index puis charge le fichier
correspondant via `getVersion`. L'ordre des entrées de `registry.json` est donc
la définition actuelle de « dernière version ».

## Unité d'immutabilité

L'unité visée est un instantané complet de `DraftUnit` identifié par le triplet
`(projectId, unitId, version)`. `publishVersion` sérialise cet instantané dans
un fichier de version et inscrit son `DeliveryManifest` dans l'index. Le
commentaire d'invariant de `FileRegistry` affirme qu'une version publiée est
immuable.

Cette immutabilité est conventionnelle à ce stade : `publishVersion` ne refuse
ni la republication d'une même version ni l'écrasement du fichier JSON
correspondant. Le registre ne propose pas non plus d'API de modification d'un
instantané déjà publié.

## Contrôles de `validateManifestForUnit`

Avant toute écriture, `publishVersion` vérifie aussi que `unit.projectId`
correspond au `projectId` demandé, valide la forme du manifeste avec
`DeliveryManifestSchema` (`src/domain/revision.ts`), puis appelle la fonction
interne `validateManifestForUnit`.

Cette fonction impose les règles suivantes :

- `manifest.units` doit contenir l'entrée exacte `(unit.id, unit.version)` ;
- une provenance éditoriale absente est acceptée, afin de préserver les
  manifestes historiques ;
- si `manifest.editorialProvenance` est présente, son `planId` doit être celui
  de `unit.editorialPlanId`, lequel doit exister ;
- les identifiants des décisions, articulations et traces de transformation de
  la provenance doivent être les mêmes ensembles sans doublon que
  `unit.appliedDecisionIds`, `unit.appliedArticulationIds` et
  `unit.transformationTraceIds`.

La structure de provenance est définie par
`EditorialManifestProvenanceSchema` dans `src/domain/revision.ts`. Elle peut
être construite par `createEditorialManifestProvenance` dans
[`src/state/editorialManifest.ts`](../../src/state/editorialManifest.ts), mais
`FileRegistry` reçoit seulement le manifeste validé : il ne reconstruit pas la
provenance.

## Sens du rollback

`rollback(projectId, unitId, version)` charge d'abord l'instantané demandé avec
`getVersion`. S'il existe, il retourne une nouvelle `DraftUnit` dérivée de cet
instantané : `version` devient `version + 1`, `status` devient `drafting` et
`updatedAt` est renouvelé. Son contenu et les autres champs sont conservés.

Le rollback est donc une préparation de révision, et non une restauration
persistée : il n'écrit aucun fichier, n'ajoute aucune entrée à `registry.json`
et ne publie pas la version préparée. L'appelant doit republier explicitement
l'unité retournée s'il souhaite la rendre canonique.

## Limites actuelles

- **Branches :** aucune branche ni parent de version n'est représenté ; les
  versions sont une liste linéaire par `unitId`.
- **Diff :** les instantanés JSON sont complets ; aucun diff textuel ou
  structurel n'est calculé ni stocké.
- **Hash :** `computeHash` dans `FileRegistry` produit une empreinte simple du
  seul champ `DraftUnit.content`. Elle n'est ni cryptographique ni vérifiée à
  la lecture, et ne couvre ni le manifeste, ni la provenance, ni les autres
  champs de l'unité. `computeDeterministicHash` dans
  `src/state/editorialManifest.ts` sert séparément aux projections éditoriales
  et ne constitue pas un mécanisme d'intégrité du registre.
