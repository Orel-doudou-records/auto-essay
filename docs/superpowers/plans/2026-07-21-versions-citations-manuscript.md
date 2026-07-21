# Versions, citations et manuscrit — Plan d’implémentation

> **Pour les agents d’exécution :** sous-compétence requise : utiliser `subagent-driven-development` (recommandé) ou `executing-plans`. Les étapes utilisent des cases à cocher pour le suivi.

**But :** comprendre le contrat de versionnement actuel, décider sur preuve si OmniGraph l’améliore, puis ajouter une citation traçable et un manuscrit composé sans redéfinir les objets canoniques existants.

**Architecture :** `FileRegistry`, `DraftUnit`, `DeliveryManifest`, `Source`, `Claim` et `EditorialPlan` restent les autorités métier. L’évaluation OmniGraph est une expérience isolée qui reproduit un sous-ensemble de ce graphe et mesure branches, diff et validation. L’extension finale ajoute uniquement les liens manquants : une citation identifiée et un manuscrit qui ordonne les `DraftUnit`.

**Technologies :** TypeScript, Zod, Vitest, stockage JSON existant ; OmniGraph CLI dans un répertoire de spike isolé.

---

## Hypothèses et critères de décision

- `FileRegistry` reste la référence tant qu’OmniGraph ne démontre pas un bénéfice de lecture ou de sûreté sur un scénario réel.
- Le spike ne connecte aucun service OmniGraph au pipeline de production et n’écrit pas dans `.auto-essay`.
- Une citation est une preuve localisable : elle conserve la source, le texte cité, le locateur et son contexte.
- Un manuscrit ne copie pas le texte des unités : il les ordonne par référence et compile une vue de lecture.

Une adoption d’OmniGraph n’est justifiée que si les quatre vérifications suivantes réussissent sur le même jeu de données :

1. créer une branche éditoriale isolée ;
2. produire un diff intelligible sur l’unité, ses claims et ses preuves ;
3. refuser ou signaler une publication sans provenance valide ;
4. retrouver une version publiée sans perte par rapport à `FileRegistry`.

## Structure de fichiers cible

- Modifier : `src/state/registry.ts` — uniquement si l’adaptateur de versionnement est adopté après le spike.
- Modifier : `src/domain/source.ts` — garder les annotations comme entrée d’ingestion ; ne pas y dupliquer les usages de citation.
- Modifier : `src/domain/draftUnit.ts` — référencer les citations utilisées et conserver la compatibilité d’`EvidencePack`.
- Créer : `src/domain/citation.ts` — contrat Zod de la citation et de son emplacement documentaire.
- Créer : `src/domain/manuscript.ts` — composition ordonnée de `DraftUnit` versionnées.
- Modifier : `src/domain/index.ts` — exporter les deux nouveaux contrats.
- Créer : `src/export/manuscriptExport.ts` — compilation Markdown et bibliographie déduite des citations réellement utilisées.
- Créer : `src/export/index.ts` — exports publics de la compilation.
- Créer : `tests/registryContract.test.ts` — tests de caractérisation du registre.
- Créer : `tests/citation.test.ts` — contrat et liens des citations.
- Créer : `tests/manuscript.test.ts` — ordre, cohérence de versions et compilation.
- Créer : `spikes/omnigraph/` — uniquement schéma, données de test et résultat d’évaluation ; jamais une dépendance applicative.
- Créer : `docs/architecture/versioning-baseline.md` et `docs/adr/0001-omnigraph-versioning-decision.md` — décisions et résultats auditables.

### Phase 1 — Caractériser le registre et la provenance existants

**Fichiers :**

- Créer : `tests/registryContract.test.ts`
- Créer : `docs/architecture/versioning-baseline.md`
- Lire : `src/state/registry.ts`, `src/state/editorialManifest.ts`, `src/domain/revision.ts`, `src/domain/draftUnit.ts`, `tests/editorialRegistry.test.ts`

- [ ] **Étape 1 : écrire les tests de caractérisation du cycle publié → lecture → rollback.**

```ts
it('returns the last published immutable unit and prepares rollback as a new draft', async () => {
  const registry = new FileRegistry(directory);
  const published = createDraftUnit({ projectId: 'p1', granularity: 'paragraph', content: 'v1' });
  await registry.publishVersion('p1', published, manifestFor(published));

  const latest = await registry.getLatest('p1', published.id);
  const rollback = await registry.rollback('p1', published.id, published.version);

  expect(latest).toMatchObject({ content: 'v1', version: 1, status: 'drafting' });
  expect(rollback).toMatchObject({ content: 'v1', version: 2, status: 'drafting' });
});
```

- [ ] **Étape 2 : exécuter le test pour confirmer le comportement actuel.**

Exécuter : `npm test -- tests/registryContract.test.ts`

Résultat attendu : succès ; le test documente le comportement avant toute intégration externe.

- [ ] **Étape 3 : ajouter le test de rejet de provenance incohérente.**

```ts
it('rejects a manifest whose editorial plan does not match the published unit', async () => {
  const { registry, unit, manifest } = await registryFixture();
  manifest.editorialProvenance!.planId = 'other-plan';

  await expect(registry.publishVersion(unit.projectId, unit, manifest))
    .rejects.toThrow('plan does not match');
});
```

- [ ] **Étape 4 : exécuter la suite de registre.**

Exécuter : `npm test -- tests/editorialRegistry.test.ts tests/registryContract.test.ts`

Résultat attendu : succès ; aucune régression sur les manifestes historiques sans provenance éditoriale.

- [ ] **Étape 5 : documenter le contrat observé.**

Créer `docs/architecture/versioning-baseline.md` avec : les fichiers publiés par `FileRegistry`, l’unité d’immutabilité (`DraftUnit@version`), les champs comparés par `validateManifestForUnit`, le sens de `rollback`, et les limites actuelles (pas de branche, pas de diff sémantique, hash de contenu uniquement).

- [ ] **Étape 6 : vérifier et committer la caractérisation.**

Exécuter : `npm run typecheck && npm test -- tests/editorialRegistry.test.ts tests/registryContract.test.ts`

Résultat attendu : succès.

Commit : `git add docs/architecture/versioning-baseline.md tests/registryContract.test.ts && git commit -m "test: characterize registry versioning contract"`

### Phase 2 — Spike décisionnel OmniGraph

**Fichiers :**

- Créer : `spikes/omnigraph/schema.pg`
- Créer : `spikes/omnigraph/seed.jsonl`
- Créer : `spikes/omnigraph/evaluate-versioning.mjs`
- Créer : `spikes/omnigraph/RESULTS.md`
- Créer : `docs/adr/0001-omnigraph-versioning-decision.md`

- [ ] **Étape 1 : déclarer un schéma de test limité aux objets existants.**

```text
node DraftUnit { key: String @key, contentHash: String, version: Int, status: String }
node Claim { key: String @key, statement: String, confidence: String }
node Source { key: String @key, title: String, verificationStatus: String }
node Plan { key: String @key, status: String }
edge ContainsClaim: DraftUnit -> Claim
edge SupportedBy: Claim -> Source
edge UsesPlan: DraftUnit -> Plan
```

- [ ] **Étape 2 : écrire un jeu de données déterministe contenant deux versions d’une unité.**

```jsonl
{"type":"DraftUnit","data":{"key":"unit-1@1","contentHash":"hash-v1","version":1,"status":"published"}}
{"type":"DraftUnit","data":{"key":"unit-1@2","contentHash":"hash-v2","version":2,"status":"drafting"}}
{"type":"Claim","data":{"key":"claim-1","statement":"La chronologie est plurielle.","confidence":"probable"}}
{"type":"Source","data":{"key":"source-1","title":"Archive municipale","verificationStatus":"verified"}}
{"type":"Plan","data":{"key":"plan-1","status":"validated"}}
{"edge":"ContainsClaim","from":"unit-1@1","to":"claim-1"}
{"edge":"SupportedBy","from":"claim-1","to":"source-1"}
{"edge":"UsesPlan","from":"unit-1@1","to":"plan-1"}
```

- [ ] **Étape 3 : exécuter localement les quatre scénarios d’évaluation.**

Exécuter : `omnigraph init --schema spikes/omnigraph/schema.pg spikes/omnigraph/versioning.omni`

Exécuter : `omnigraph load --data spikes/omnigraph/seed.jsonl --mode overwrite --store spikes/omnigraph/versioning.omni`

Exécuter : `omnigraph branch create --store spikes/omnigraph/versioning.omni --from main editorial/citation-revision`

Résultat attendu : la branche existe sans modifier le graphe principal.

- [ ] **Étape 4 : écrire le script de requêtes d’évaluation.**

`evaluate-versioning.mjs` exécute des requêtes qui retournent, pour `unit-1@1`, ses claims, leurs sources et son plan ; puis compare la branche à `main`. Le script échoue avec code non nul si la requête ne retrouve pas les quatre relations attendues ou si une version publiée ne peut être relue.

- [ ] **Étape 5 : consigner les résultats sans conclure par préférence.**

Créer `spikes/omnigraph/RESULTS.md` sous forme de tableau : scénario, commande, résultat, lisibilité du diff, données perdues, friction d’exploitation. Les quatre scénarios de la section « critères de décision » doivent chacun être marqués réussi, échoué ou non couvert.

- [ ] **Étape 6 : écrire l’ADR d’adoption ou de non-adoption.**

Créer `docs/adr/0001-omnigraph-versioning-decision.md` avec une seule décision :

```text
Décision : conserver FileRegistry / adopter OmniGraph comme adaptateur expérimental.
Justification : les quatre scénarios mesurés et leur coût opérationnel.
Conséquence : aucune modification du pipeline si la décision est « conserver ».
```

- [ ] **Étape 7 : vérifier et committer le spike.**

Exécuter : `npm run typecheck && npm test -- tests/editorialRegistry.test.ts tests/registryContract.test.ts`

Résultat attendu : succès ; le spike n’ajoute pas de dépendance TypeScript de production.

Commit : `git add spikes/omnigraph docs/adr/0001-omnigraph-versioning-decision.md && git commit -m "docs: evaluate omnigraph versioning spike"`

### Phase 3 — Ajouter citations traçables et manuscrit composé

**Précondition :** exécuter cette phase seulement après l’ADR de phase 2. Si OmniGraph n’est pas retenu, elle s’appuie entièrement sur `FileRegistry`.

**Fichiers :**

- Créer : `src/domain/citation.ts`
- Créer : `src/domain/manuscript.ts`
- Modifier : `src/domain/draftUnit.ts`
- Modifier : `src/domain/index.ts`
- Créer : `src/export/manuscriptExport.ts`
- Créer : `src/export/index.ts`
- Créer : `tests/citation.test.ts`
- Créer : `tests/manuscript.test.ts`

- [ ] **Étape 1 : écrire le test de citation localisable.**

```ts
const citation = CitationSchema.parse({
  id: 'citation-1',
  projectId: 'project-1',
  sourceId: 'source-1',
  quote: 'Chaque source conserve sa propre chronologie.',
  locator: { kind: 'page', value: '12' },
  context: 'Conclusion de l’entretien',
  verificationStatus: 'verified',
  createdAt: '2026-07-21T00:00:00.000Z',
});

expect(citation.locator).toEqual({ kind: 'page', value: '12' });
```

- [ ] **Étape 2 : implémenter le contrat minimal de citation.**

`src/domain/citation.ts` exporte `CitationSchema`, `Citation`, `CitationUseSchema` et `CitationUse`. `CitationUse` contient `citationId`, `draftUnitId`, `draftUnitVersion` et une plage de caractères optionnelle. Une citation ne contient ni claim ni contenu de manuscrit dupliqué.

- [ ] **Étape 3 : lier les usages au `DraftUnit` sans casser l’`EvidencePack` historique.**

Ajouter `citationUses: z.array(CitationUseSchema).default([])` à `DraftUnitSchema` et à `createDraftUnit`. Conserver `EvidencePack.keyCitations` intact pour les appels existants ; il reste un matériau de préparation, tandis que `citationUses` décrit les citations effectivement employées dans une version rédigée.

- [ ] **Étape 4 : exécuter les tests de contrat.**

Exécuter : `npm test -- tests/citation.test.ts tests/draftUnit.test.ts`

Résultat attendu : succès ; les anciens appels à `createDraftUnit` conservent `citationUses: []`.

- [ ] **Étape 5 : écrire le test du manuscrit composé.**

```ts
const manuscript = createManuscript({
  projectId: 'project-1',
  title: 'Essai de démonstration',
  units: [
    { unitId: 'unit-introduction', version: 1, order: 0 },
    { unitId: 'unit-conclusion', version: 2, order: 1 },
  ],
});

expect(manuscript.units.map((unit) => unit.order)).toEqual([0, 1]);
expect(() => ManuscriptSchema.parse({ ...manuscript, units: [manuscript.units[0], manuscript.units[0]] })).toThrow();
```

- [ ] **Étape 6 : implémenter le contrat et la compilation.**

`src/domain/manuscript.ts` exporte `ManuscriptSchema` avec `projectId`, `title`, `units` et dates. Chaque entrée de `units` contient `unitId`, `version` et `order`; les couples unité/version et les ordres sont uniques. `compileManuscript(manuscript, units, citations, sources)` dans `src/export/manuscriptExport.ts` :

1. vérifie que chaque référence d’unité existe avec la version demandée ;
2. concatène les contenus dans l’ordre ;
3. collecte les `sourceId` à partir des `citationUses` ;
4. retourne `markdown` et la liste dédupliquée de `Source` pour la bibliographie.

- [ ] **Étape 7 : tester la compilation et l’échec sûr.**

```ts
const result = compileManuscript(manuscript, [intro, conclusion], [citation], [source]);
expect(result.markdown).toContain(intro.content);
expect(result.sources).toEqual([source]);

expect(() => compileManuscript(manuscript, [intro], [citation], [source]))
  .toThrow('unit-conclusion@2');
```

Exécuter : `npm test -- tests/manuscript.test.ts tests/citation.test.ts`

Résultat attendu : succès ; aucune compilation ne substitue silencieusement une autre version d’unité.

- [ ] **Étape 8 : exécuter la vérification complète et committer.**

Exécuter : `npm run typecheck && npm test && npm run demo:synthetic && npm run demo:station-reverse`

Résultat attendu : succès.

Commit : `git add src/domain src/export tests && git commit -m "feat: add traceable citations and composed manuscripts"`

## Revue du plan

- Couverture : la phase 1 décrit précisément le registre et ses invariants ; la phase 2 produit une décision réversible ; la phase 3 ajoute uniquement citation et manuscrit.
- Hors périmètre : connecteur Zotero, moteur de recherche externe, interface graphique, migration de toutes les données existantes et remplacement immédiat de `FileRegistry`.
- Compatibilité : `EvidencePack.keyCitations` et les manifestes historiques restent valides.
