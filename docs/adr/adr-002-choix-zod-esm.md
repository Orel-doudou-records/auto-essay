# ADR-002 : Choix de Zod et d'ESM

## Statut

Accepté

## Contexte

Le projet manipule de nombreuses structures métier (sources, claims, unités de rédaction, plans éditoriaux, traces). Nous avions besoin d'un mécanisme de validation robuste au runtime et d'un système de modules moderne.

## Décision

- **Zod** comme bibliothèque de validation et de dérivation de types.
- **ESM natif** (`"type": "module"` dans `package.json`) avec import explicite des modules Node (`node:path`, `node:crypto`).

## Conséquences

- Les types TypeScript sont dérivés des schémas Zod : une seule source de vérité.
- Les entrées/sorties des clients LLM sont validées avant usage.
- ESM impose des imports plus explicites et interdit `require` implicite, ce qui réduit les erreurs de chargement.
- Certains outils tiers moins compatibles avec ESM nécessitent une configuration additionnelle.

## Alternatives rejetées

- **Joi / Yup** : moins intégré à l'inférence TypeScript.
- **TypeScript strict sans runtime validation** : insuffisant pour les données issues d'appels LLM.
- **CommonJS** : plus permissif mais moins aligné avec l'écosystème moderne et les imports `node:`.
