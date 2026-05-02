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

---

## Phases

### Phase 1 : Intake (Cadrage)

**Input** : `thesis_seed.md` ou formulaire de cadrage
**Output** : Configuration projet, objectifs

Processus :
1. Définir la question centrale
2. Choisir la granularité (paragraph / section / chapter / book)
3. Configurer la voix essayistique (`essay_voice.md`)
4. Valider le périmètre (`context_scope.md`)

### Phase 2 : Sourcing (Ingestion)

**Input** : PDF, Markdown, BibTeX, Zotero
**Output** : Sources structurées dans `Source[]`

Processus :
1. Importer les documents
2. Extraire les annotations/citations
3. Vérifier les métadonnées (DOI, auteurs)
4. Normaliser le format

### Phase 3 : Planning (Carte Argumentative)

**Input** : Sources + thèse
**Output** : `argument_map.md`

Processus :
1. Identifier les preuves majeures
2. Cartographier les objections
3. Structurer les transitions
4. Marquer les dettes documentaires

**Exit Criteria** : `planning_score > 7.5`
**Max iterations** : 20

### Phase 4 : Drafting (Rédaction)

**Input** : Argument map + Evidence pack
**Output** : `draft_units/*.md`

Processus par unité :
1. Sélectionner sources et citations (evidence pack)
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
├── ingestion/        # Import Markdown, BibTeX, PDF, Zotero
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
- [x] Ingestion Markdown et BibTeX
- [x] Mode paragraphe (prompt + pipeline)
- [x] Mechanical checks (anti-overclaim)
- [x] Évaluateur read-only
- [x] Reviewer distinct + briefs
- [x] Tests unitaires passant
- [ ] Export Pandoc/PDF/ZIP
- [ ] Connecteur Zotero
- [ ] Mode section/chapitre/livre
- [ ] Git integration
- [ ] runs.tsv

## Anti-Patterns

1. Pas de "plan est exécution" → séparer intention, exécution, livraison
2. Pas de génération sans preuves → evidence pack obligatoire
3. Pas de reporting sans vérification → invariant `report_requires_verification`
4. Pas d'auto-évaluation du writer → judge ≠ writer
5. Pas de chaîne de pensée exposée → sorties structurées uniquement
