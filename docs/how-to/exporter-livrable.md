# Comment exporter un livrable

Ce guide explique comment compiler les unités validées et produire les fichiers de sortie.

> **Attention** : L'export Pandoc/PDF/ZIP n'est pas encore implémenté en MVP. Ce guide décrit l'API existante et la marche à suivre manuelle en attendant.

## Prérequis : vérification obligatoire

Avant toute exportation, la state machine exige que le projet soit marqué comme vérifié. C'est l'invariant `Exécuter → Vérifier → Rendre`.

```typescript
import { createStateMachine } from "@auto-essay/core";

const stateMachine = createStateMachine();

// Marquer comme vérifié
await stateMachine.markVerified(project.id);

// Transitionner vers l'export
const state = await stateMachine.transitionToPhase(project.id, "export");
console.log("Phase :", state.phase); // "export"
```

Si vous tentez la transition sans `markVerified`, une exception est levée :

```
Invariant violation: Cannot export without verification
```

## Compiler les unités validées

Récupérez les dernières versions depuis le registry et assemblez-les dans l'ordre logique.

```typescript
import { createRegistry } from "@auto-essay/core";

const registry = createRegistry();

const units: DraftUnit[] = [];
for (const unitId of project.draftUnitIds) {
  const latest = await registry.getLatest(project.id, unitId);
  if (latest && latest.status === "verified") {
    units.push(latest);
  }
}

const fullText = units.map((u) => u.content).join("\n\n");
```

## Produire un manifest de livraison

Le `DeliveryManifest` trace ce qui est publié, avec les scores, les sources utilisées et les dettes restantes.

```typescript
import { DeliveryManifestSchema } from "@auto-essay/core";

const manifest = DeliveryManifestSchema.parse({
  version: 1,
  publishedAt: new Date().toISOString(),
  units: units.map((u) => ({
    unitId: u.id,
    version: u.version,
    score: u.scores?.overall ?? 0,
  })),
  sourcesUsed: project.sourceIds,
  verifiedClaims: project.claims,
  remainingDebts: state.debts.filter((d) => !d.resolvedAt).map((d) => d.id),
  exports: {
    markdown: "./output/essay.md",
  },
});
```

## Publier dans le registry

Pour chaque unité, publiez une version immuable :

```typescript
for (const unit of units) {
  await registry.publishVersion(project.id, unit, manifest);
}
```

Le registry crée un fichier `{unitId}_v{version}.json` et met à jour `registry.json` avec les métadonnées (hash, date, score).

## Rollback vers une version antérieure

Si une nouvelle version dégrade la qualité, vous pouvez revenir en arrière :

```typescript
const rolledBack = await registry.rollback(project.id, unitId, 2);
// Crée une nouvelle version (v3) basée sur la v2
```

## Export Markdown manuel (en attendant Pandoc)

```typescript
import fs from "fs";

const markdown = `# ${project.title}

${project.thesisSeed}

## Sources

${units.flatMap((u) => u.evidencePack.sourceIds).join("\n")}

${fullText}
`;

fs.writeFileSync("./output/essay.md", markdown);
```

## Voir aussi

- [Référence : State machine](../reference/state-machine.md)
- [Référence : API](../reference/api.md)
