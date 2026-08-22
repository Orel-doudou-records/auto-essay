# Référence : API publique

Ce document décrit les fonctions, classes et types exportés par le point d'entrée principal du moteur.

## Point d'entrée

```typescript
import { ... } from "@auto-essay/core";
```

Tous les exports proviennent de `src/index.ts` et sont répartis en six modules : `domain`, `state`, `ingestion`, `evaluation`, `revision`, `pipeline`.

---

## Domaine

### `createEssayProject(partial)`

Crée un nouveau projet essayistique avec un ID et des dates auto-générés.

```typescript
function createEssayProject(
  partial: Omit<Partial<EssayProject>, "id" | "createdAt" | "updatedAt"> & {
    title: string;
  }
): EssayProject;
```

| Champ requis | Type | Description |
|--------------|------|-------------|
| `title` | `string` | Titre du projet |

| Champs optionnels courants | Type | Valeur par défaut |
|----------------------------|------|-------------------|
| `thesisSeed` | `string` | `""` |
| `contextScope` | `string` | `""` |
| `periodOrField` | `string` | `undefined` |
| `voiceConfig` | `EssayVoice` | `undefined` |

### `createDraftUnit(partial)`

Crée une unité de rédaction (paragraphe, section, chapitre ou livre).

```typescript
function createDraftUnit(
  partial: Omit<Partial<DraftUnit>, "id" | "createdAt" | "updatedAt"> & {
    projectId: string;
    granularity: Granularity;
  }
): DraftUnit;
```

| Champ requis | Type | Description |
|--------------|------|-------------|
| `projectId` | `string` | ID du projet parent |
| `granularity` | `"paragraph" \| "section" \| "chapter" \| "book"` | Niveau de détail |

L'objectif de mots est calculé automatiquement (`DEFAULT_WORD_COUNTS`) sauf si `targetWordCount` est fourni.

### `createClaim(partial)`

Crée une assertion traçable dans le claim ledger.

```typescript
function createClaim(
  partial: Omit<Partial<Claim>, "id" | "createdAt"> & {
    projectId: string;
    statement: string;
    confidenceLevel: ConfidenceLevel;
  }
): Claim;
```

| Valeurs `ConfidenceLevel` | Signification |
|---------------------------|---------------|
| `"certain"` | Preuve solide, consensus |
| `"probable"` | Indices forts |
| `"speculative"` | Hypothèse à explorer |
| `"unsupported"` | Non prouvé (bloque la publication) |

### `createSource(partial)`

Crée une source documentaire.

```typescript
function createSource(
  partial: Omit<Partial<Source>, "id"> & {
    projectId: string;
    title: string;
    content: string;
  }
): Source;
```

### `createEssayState(projectId)`

Crée un nouvel état de pipeline en phase `intake`.

```typescript
function createEssayState(projectId: string): EssayState;
```

---

## État

### `createStateMachine(basePath?)`

Factory pour instancier une `StateMachine` avec un `FileStateManager`.

```typescript
function createStateMachine(basePath?: string): StateMachine;
// basePath défaut : "./.auto-essay"
```

### `StateMachine`

Orchestre le pipeline et garantit les invariants.

| Méthode | Description |
|---------|-------------|
| `initialize(projectId)` | Crée un nouvel état persistant |
| `transitionToPhase(projectId, phase)` | Transitionne vers une nouvelle phase (uniquement en avant) |
| `incrementIteration(projectId)` | Incrémente le compteur d'itération courante |
| `incrementRevisionCycle(projectId)` | Incrémente le cycle de révision |
| `updateUnitScore(projectId, unitId, score)` | Met à jour le score d'une unité |
| `updateGlobalScore(projectId, score)` | Met à jour le score global |
| `addDebt(projectId, debt)` | Ajoute une dette documentaire |
| `resolveDebt(projectId, debtId)` | Marque une dette comme résolue |
| `markVerified(projectId)` | Définit `lastVerifiedAt` (prérequis pour l'export) |
| `updateFocus(projectId, focus)` | Met à jour le focus textuel courant |
| `getState(projectId)` | Charge l'état actuel |

### `createRegistry(basePath?)`

Factory pour instancier un `FileRegistry`.

```typescript
function createRegistry(basePath?: string): Registry;
```

### `Registry`

Gestion déterministe des versions.

| Méthode | Description |
|---------|-------------|
| `publishVersion(projectId, unit, manifest)` | Publie une version immuable |
| `getLatest(projectId, unitId)` | Récupère la dernière version |
| `getVersion(projectId, unitId, version)` | Récupère une version spécifique |
| `rollback(projectId, unitId, version)` | Crée une nouvelle version basée sur une ancienne |
| `listVersions(projectId, unitId)` | Liste toutes les versions |

---

## Ingestion

### `importMarkdown(filePath, content, projectId)`

Importe un fichier Markdown avec frontmatter YAML.

```typescript
function importMarkdown(filePath: string, content: string, projectId: string): Source;
```

### `importMarkdownFiles(files, projectId)`

Importe plusieurs fichiers Markdown en lot.

```typescript
function importMarkdownFiles(
  files: Array<{ path: string; content: string }>,
  projectId: string
): ImportResult;
```

### `importBibTeX(content, projectId)`

Importe un fichier BibTeX.

```typescript
function importBibTeX(content: string, projectId: string): ImportResult;
```

### `parseBibTeX(content)`

Parse le contenu BibTeX brut en entrées structurées.

```typescript
function parseBibTeX(content: string): Array<{ type: string; key: string; fields: Record<string, string> }>;
```

---

## Évaluation

### `createEssayEvaluator(client, judgeModel?)`

Factory pour l'évaluateur.

```typescript
function createEssayEvaluator(
  client: StructuredModelClient,
  judgeModel?: string
): EssayEvaluator;
```

### `EssayEvaluator.evaluate(context)`

Évalue une unité de rédaction.

```typescript
async evaluate(context: EvaluationContext): Promise<EssayEvaluation>;
```

`EvaluationContext` :
- `unit` : `DraftUnit` — unité à évaluer
- `sources` : `Source[]` — sources disponibles
- `claims` : `Claim[]` — assertions liées à l'unité
- `voice` : `EssayVoice` (optionnel) — voix attendue
- `previousEvaluations` : `EssayEvaluation[]` (optionnel) — historique

### `runMechanicalChecks(text)`

Exécute toutes les vérifications mécaniques et retourne les issues triées par sévérité.

```typescript
function runMechanicalChecks(text: string): MechanicalIssue[];
```

### `passesMechanicalChecks(text, maxErrors?, maxWarnings?)`

Vérifie si le texte passe les contrôles mécaniques.

```typescript
function passesMechanicalChecks(
  text: string,
  maxErrors?: number,
  maxWarnings?: number
): { passed: boolean; issues: MechanicalIssue[] };
```

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `maxErrors` | `0` | Nombre maximum d'erreurs tolérées |
| `maxWarnings` | `5` | Nombre maximum de warnings tolérés |

---

## Révision

### `createRevisionBriefGenerator()`

Factory pour le générateur de briefs.

```typescript
function createRevisionBriefGenerator(): RevisionBriefGenerator;
```

### `RevisionBriefGenerator.generateBrief(evaluation, unit)`

Génère un brief de révision à partir d'une évaluation.

```typescript
generateBrief(evaluation: EssayEvaluation, unit: DraftUnit): RevisionBrief;
```

---

## Pipeline

### `createParagraphGenerator(client)`

Factory pour le générateur de paragraphes.

```typescript
function createParagraphGenerator(client: StructuredModelClient): ParagraphGenerator;
```

### `ParagraphGenerator.generateParagraph(evidencePack, sources, context?)`

Génère un paragraphe structuré.

```typescript
async generateParagraph(
  evidencePack: EvidencePack,
  sources: Source[],
  context?: { section?: string; precedingText?: string; thesis?: string }
): Promise<ParagraphGenerationResult>;
```

---

## Utilitaires

### `countWords(content)`

Compte les mots dans une chaîne.

```typescript
function countWords(content: string): number;
```

### `meetsWordCountTarget(unit)`

Vérifie si le contenu d'une unité respecte son objectif ±20 %.

```typescript
function meetsWordCountTarget(unit: DraftUnit): boolean;
```

### `isClaimPublishable(claim)`

Retourne `false` si la claim a un niveau de confiance `"unsupported"` et n'est pas explicitement vérifiée.

```typescript
function isClaimPublishable(claim: Claim): boolean;
```

### `snapshotProject(project, sources, claims, draftUnits)`

Crée un snapshot immuable du projet.

```typescript
function snapshotProject(
  project: EssayProject,
  sources: Source[],
  claims: Claim[],
  draftUnits: DraftUnit[]
): ProjectSnapshot;
```

## Voir aussi

- [Référence : State machine](state-machine.md)
- [Référence : Système d'évaluation](evaluation.md)
- [Référence : Formats de sortie](formats-sortie.md)
