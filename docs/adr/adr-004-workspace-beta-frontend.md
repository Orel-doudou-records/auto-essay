# ADR-004 — Workspace npm et séparation `apps/api` / `apps/web` pour la beta frontend

## Contexte

Le moteur `auto-essay` était initialement un package Node unique (`@auto-essay/core`). Pour la beta frontend, nous avons besoin d'une interface graphique locale qui communique avec le moteur sans altérer ses objets canoniques ni dupliquer sa logique métier.

## Décision

Adopter un workspace npm avec trois membres :

- `@auto-essay/core` (racine) : moteur métier existant.
- `@auto-essay/api` (`apps/api`) : serveur Hono TypeScript qui expose une API REST locale.
- `@auto-essay/web` (`apps/web`) : SPA React/Vite qui consomme l'API.

L'API et le frontend partagent `@auto-essay/core` via le lien local du workspace npm.

## Alternatives considérées

1. **Backend intégré au core** : rejetté car cela polluerait le package core avec des dépendances serveur (Hono, CORS, etc.) et mélangerait les responsabilités.
2. **Frontend qui importe directement le core** : rejetté car le core utilise des API Node (`fs`) et des appels LLM structurés difficiles à exécuter dans le navigateur.
3. **Package `packages/core` séparé** : rejetté pour minimiser la refonte du dépôt existant ; le core reste à la racine comme package principal.

## Conséquences

- `npm install` à la racine installe les dépendances de tous les workspaces.
- Les scripts root (`dev`, `typecheck`, `lint`, `test`, `build`) orchestrent les trois parties.
- L'API reste une fine couche de parse/validation/délégation au core.
- Le frontend reste offline-first : seuls les appels LLM nécessitent Internet, et uniquement si `OPENAI_API_KEY` est configuré.

## Vérification

- `npm run typecheck` passe.
- `npm run dev` lance API + frontend.
- `npm run test:api` et `npm run test:web` passent.
