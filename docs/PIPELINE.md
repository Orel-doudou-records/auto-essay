# Agent Orienté Essai : Pipeline Reproductible

## Vue d'ensemble

Pipeline autonome de rédaction essayistique, du corpus brut au livrable final.

Inspiré de :
- **autonovel** : boucle modify-evaluate-keep/discard, séparation juge/écrivain
- **OpenClaw** : state machine, registry déterministe, invariant Execute → Verify → Report
- **Litfract** : philosophie de décision éditoriale

## Principes directeurs

1. **Tester à l'échelle du paragraphe, architecturer pour toutes les granularités**
2. **Claim ledger au centre** : aucune assertion non vérifiée en publication
3. **Séparation juge/écrivain** : modèle d'évaluation différent du modèle de rédaction
4. **Execute → Verify → Report** : pas de livraison sans vérification préalable
5. **Sorties structurées** : JSON strict, pas de markdown flou
6. **Autorité documentaire explicite** : `Source` identifie ; `IngestedDocument` porte le contenu canonique ; retrieval, citation et support argumentatif restent distincts

## Chemin documentaire Corpus V2

```text
Source
  → IngestedDocument
  → SourceProfile
  → Comprehension Closure
  → CorpusSynthesis / CorpusExplorer
  → RetrievedPassage
  → Citation vérifiée
  → ContentRelation
  → projection documentaire du scope
  → PlanningBrief / EditorialPlan
  → EvidencePack
  → Writer
  → Judge
```

Deux entrées sont supportées :

- **corpus-first** : le sujet peut émerger d'un corpus fermé avant la création du `Manuscript` ; un shell de manuscrit n'est créé qu'au moment où un sujet retenu devient `PlanningBrief` ;
- **scope-first** : un `PlanningBrief` existant pilote exploration/corroboration, puis les passages rematérialisés et vérifiés alimentent la projection documentaire du scope.

Invariants Corpus V2 :

- `source registered != source understood` ;
- toute synthèse globale exige la Comprehension Closure des sources actives ou leur exclusion explicite ;
- `RetrievedPassage` est transitoire et toujours rematérialisé depuis `IngestedDocument` ;
- `Citation` = provenance vérifiée, `ContentRelation` = fonction argumentative ;
- `EvidencePack` reste une projection Writer, jamais une autorité documentaire ;
- `CorpusSynthesis` et les projections de scope sont reconstruisibles, pas canoniques ;
- aucun `DocumentMap`, `CorpusMap` ou `Evidence` canonique ;
- Diffract ne déclenche pas le retrieval ;
- une nouvelle version de source revalide seulement ses dépendances directes et ne réécrit jamais automatiquement `Manuscript.tree` ;
- PageIndex n'est pas un backend runtime supporté à ce stade ; voir `docs/architecture/CORPUS_V2_PAGEINDEX_BENCHMARK.md`.

---

## Phases

### Phase 1 : Intake (Cadrage)

**Input** : `thesis_seed.md`, formulaire de cadrage **ou corpus seul**
**Output** : Configuration projet, objectifs ou cadrage initial minimal

Processus :
1. Définir une question centrale lorsqu'elle existe déjà, sans l'imposer à un flux corpus-first
2. Choisir la granularité (paragraph / section / chapter / book)
3. Configurer la voix essayistique (`essay_voice.md`)
4. Valider le périmètre (`context_scope.md`)

### Phase 2 : Sourcing (Ingestion + compréhension)

**Input** : PDF, Markdown, BibTeX, Zotero
**Output** : `Source[]` + `IngestedDocument[]` + `SourceProfile[]`

Processus :
1. Enregistrer l'identité bibliographique dans `Source`
2. Extraire le contenu dans `IngestedDocument` avec fingerprint, blocs, locators et diagnostics
3. Construire `SourceProfile` depuis le contenu ingéré, jamais depuis les seules métadonnées
4. Vérifier la Comprehension Closure du corpus actif
5. Signaler explicitement toute source `degraded` ou `unreadable`

### Phase 3 : Planning (Corpus + intention éditoriale)

**Input** : corpus fermé ou `PlanningBrief` existant
**Output** : sujets/axes dérivés, puis `PlanningBrief` et `EditorialPlan`

Processus :
1. En corpus-first, comparer les profils fermés et matérialiser les anchors en `RetrievedPassage`
2. Proposer plusieurs sujets/axes ancrés dans des passages réels
3. En scope-first, rechercher séparément support, contradiction, qualification, contre-exemple ou alternative
4. Promouvoir seulement les passages vérifiés en `Citation`
5. Qualifier leur fonction argumentative via `ContentRelation`
6. Projeter la matière documentaire pertinente vers le scope
7. Compiler l'intention retenue en `EditorialPlan` sans muter automatiquement la structure du manuscrit

**Exit Criteria** : fondation documentaire traçable + contrat éditorial valide

### Phase 4 : Drafting (Rédaction)

**Input** : `EditorialPlan` + `EvidencePack`
**Output** : `draft_units/*.md`

Processus par unité :
1. Projeter sources, citations et objections dans l'EvidencePack
2. Générer le contenu (writer model)
3. Extraire les claims
4. Vérifications mécaniques (anti-overclaim)
5. Évaluation (judge model)
6. Si score > 6.0 → garder, commit
7. Si score < 6.0 → discard, retry (max 5)

**Seuil de qualité** : 6.0 (comme autonovel)
**Max retries** : 5 par unité

### Phase 5 : Revision (Révision)

**Input** : Draft units + évaluations
**Output** : `essay_briefs/*.md` + drafts révisés

Processus cyclique (3-6 cycles) :
1. Évaluer toutes les unités
2. Détecter les patterns systémiques
3. Générer des briefs de révision
4. Appliquer les révisions
5. Ré-évaluer
6. Détecter plateau (Δ < 0.3 sur 2 cycles)

**Verdicts possibles** :
- `keep` : garder tel quel
- `keep_with_minor_edits` : éditions mineures
- `revise` : révision substantielle
- `discard` : réécrire

### Phase 6 : Export (Livrables)

**Input** : Units validées
**Output** : Markdown + PDF + BibTeX + ZIP

Processus :
1. Compiler les units en document unique
2. Générer la bibliographie
3. Exporter via Pandoc
4. Créer le package ZIP avec manifest

**Invariant** : Pas d'export sans `lastVerifiedAt`

---

## Architecture

```
packages/essay-core/
├── domain/           # Types métier (Source, Claim, DraftUnit, EssayProject)
├── state/            # State machine + Registry déterministe
├── ingestion/        # Source + IngestedDocument, Markdown/PDF/BibTeX
├── bibliography/     # Profiles, closure, retrieval, citations, scope projection
├── evaluation/       # Évaluateur read-only + Mechanical checks
├── revision/         # Génération de briefs
├── pipeline/         # Modes paragraphe/section/chapitre/livre
└── export/           # Markdown, PDF, BibTeX, ZIP
```

## Système dual d'évaluation

### Immune System 1 : Mécanique (sans LLM)

Détecte :
- Assertions fortes sans citation
- Phrases de remplissage
- Transitions surutilisées
- Format de citations incorrect
- Frontières fait/interprétation floues

### Immune System 2 : LLM (judge model)

Évalue selon 6 dimensions :
1. **claimSupport** : Preuves suffisantes ?
2. **citationIntegrity** : Citations correctes ?
3. **counterargumentQuality** : Objections traitées ?
4. **transitionClarity** : Enchaînements logiques ?
5. **scopeControl** : Pas de sur-généralisation ?
6. **voiceConsistency** : Ton maintenu ?

## State Management

```typescript
interface EssayState {
  phase: 'intake' | 'sourcing' | 'planning' | 'drafting' | 'reviewing' | 'export';
  currentFocus: string;
  iteration: number;
  unitScores: Record<string, number>;
  globalScore: number;
  revisionCycle: number;
  debts: Debt[];
  lastVerifiedAt?: string;
}
```

**Transitions valides** : intake → sourcing → planning → drafting → reviewing → export

## Registry

Déterministe, pas agentique.

```typescript
interface Registry {
  publishVersion(projectId, unit, manifest): VersionEntry;
  getLatest(projectId, unitId): DraftUnit;
  rollback(projectId, unitId, version): DraftUnit;
  listVersions(projectId, unitId): VersionEntry[];
}
```

## Prompts par Granularité

### Mode PARAGRAPHE

```
Tu travailles en mode PARAGRAPHE.
Objectif : intégrer le fragment dans une section, sans sur-interpréter.
Contraintes :
- 180-220 mots
- 2 citations max, toutes de l'evidence pack
- distingue fait / interprétation / hypothèse
- assertion non prouvée → reformuler prudemment
Sortie : JSON { plan_3_sentences, paragraph, claims, confidence_assessment }
```

### Mode SECTION

```
Mode SECTION.
Construis une section de 1200-1500 mots.
Tu dois :
- proposer un sous-plan en 4 mouvements
- signaler 3 objections
- rédiger la section
- produire un claim ledger
- lister ce qui doit être vérifié
```

### Mode CHAPITRE

```
Mode CHAPITRE.
Crée :
- carte argumentative détaillée
- transitions principales
- passages nécessitant source primaire
- brief de révision
Ne rédige pas si sources insuffisantes.
```

### Mode LIVRE

```
Mode LIVRE.
Construis l'architecture d'un essai complet :
- question centrale, thèse
- 8-10 chapitres avec promesses
- preuves majeures, objections
- dettes documentaires
- ordre des phases de rédaction
Sortie : JSON structuré + Markdown
```

## Checklist MVP

- [x] Schémas métier (Source, Claim, DraftUnit, EssayProject)
- [x] State machine + registry déterministe
- [x] Ingestion Markdown, BibTeX et PDF canonique
- [x] Comprehension Closure + découverte corpus-first
- [x] CorpusExplorer exploration/corroboration
- [x] Citation + ContentRelation sans entité Evidence parallèle
- [x] Projection documentaire par scope
- [x] Invalidation ciblée par fingerprint
- [x] Mode paragraphe (prompt + pipeline)
- [x] Mechanical checks (anti-overclaim)
- [x] Évaluateur read-only
- [x] Reviewer distinct + briefs
- [x] Tests unitaires + E2E Corpus V2
- [ ] Export Pandoc/PDF/ZIP
- [ ] Connecteur Zotero
- [x] Mode section
- [ ] Mode chapitre
- [ ] Mode livre
- [ ] Git integration
- [ ] runs.tsv

## Anti-Patterns

1. Pas de "plan est exécution" → séparer intention, exécution, livraison
2. Pas de génération sans preuves → evidence pack obligatoire
3. Pas de reporting sans vérification → invariant `report_requires_verification`
4. Pas d'auto-évaluation du writer → judge ≠ writer
5. Pas de chaîne de pensée exposée → sorties structurées uniquement
6. Pas de `Source.content` utilisé comme substitut de `IngestedDocument`
7. Pas de metadata-only `SourceProfile` pour fermer un corpus
8. Pas de distribution cognitive statique source→scope
9. Pas de PageIndex/Graphify comme autorité documentaire
