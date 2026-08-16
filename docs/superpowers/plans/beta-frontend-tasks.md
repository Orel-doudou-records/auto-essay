# Beta frontend — Plan de tâches

> Fichier : `docs/superpowers/plans/beta-frontend-tasks.md`  
> Généré à partir de `docs/superpowers/plans/beta-frontend-spec.md`

## Objectif

Livrer une interface graphique locale offline-first (React/Vite + API Hono) qui expose les capacités existantes du moteur : création de projet, ingestion de sources, rédaction assistée, révision par chat, évaluation et export Markdown. Le moteur reste la source de vérité ; le frontend n'ajoute aucun objet canonique.

---

## Architecture cible

```mermaid
graph TB
    subgraph Apps
        W[apps/web — React SPA Vite]
        A[apps/api — Hono local]
    end
    W -->|HTTP / SSE| A
    A -->|appelle| Core[@auto-essay/core]
    Core -->|lit/écrit| FS[.auto-essay/]
    A -->|HTTPS| LLM[API OpenAI-compatible]
```

- `apps/web` : SPA React, Tailwind CSS, shadcn/ui, React Router.
- `apps/api` : serveur Hono TypeScript, Zod, middlewares.
- Workspace npm : `apps/*` partagent `@auto-essay/core` via lien local.

---

## Phase 1 — Bootstrap

### T1.1 Initialiser `apps/api` (serveur Hono)
- Créer `apps/api/package.json`, `tsconfig.json`, `src/index.ts`.
- Ajouter `hono`, `zod`, `@hono/node-server`.
- Ajouter route `/api/health`.
- **Skills** : `api-and-interface-design`, `using-agent-skills`
- **Fichiers impactés** : `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/src/index.ts`, `apps/api/src/app.ts`
- **Critère d'acceptation** : `npm run dev:api` démarre et `GET /api/health` retourne `200 { status: "ok" }`.
- **Dépendances** : —

### T1.2 Initialiser `apps/web` (SPA Vite + React)
- Créer `apps/web/package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`.
- Ajouter `react`, `react-dom`, `react-router-dom`, `tailwindcss`, `class-variance-authority`, `clsx`, `tailwind-merge`.
- Installer shadcn/ui (composants de base : Button, Input, Textarea, Dialog, Card, Select).
- **Skills** : `frontend-ui-engineering`, `using-agent-skills`
- **Fichiers impactés** : `apps/web/package.json`, `apps/web/vite.config.ts`, `apps/web/tsconfig.json`, `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/App.tsx`, `apps/web/tailwind.config.js`, `apps/web/src/index.css`
- **Critère d'acceptation** : `npm run dev:web` ouvre l'app sur `http://localhost:5173` avec un écran d'accueil minimal.
- **Dépendances** : —

### T1.3 Configurer le workspace root
- Passer `package.json` racine en workspace npm (`"workspaces": ["apps/*"]`).
- Ajouter les scripts cross-dev : `dev` (concurrently ou npm-run-all), `build`, `typecheck`, `test`, `lint` au niveau root.
- Assurer la résolution de `@auto-essay/core` pour `apps/api` et `apps/web` (npm workspace link).
- **Skills** : `using-agent-skills`
- **Fichiers impactés** : `package.json`, `package-lock.json`
- **Critère d'acceptation** : `npm install` réussit à la racine ; les deux apps peuvent importer `@auto-essay/core`.
- **Dépendances** : T1.1, T1.2

### T1.4 Configurer proxy Vite et serving statique Hono
- En dev : proxy Vite redirige `/api/*` vers `http://localhost:3000`.
- En prod / build local : Hono sert le dossier `apps/web/dist` via `@hono/node-server` + `serveStatic` (ou middleware maison).
- **Skills** : `frontend-ui-engineering`, `api-and-interface-design`
- **Fichiers impactés** : `apps/web/vite.config.ts`, `apps/api/src/app.ts`
- **Critère d'acceptation** : `npm run dev` lance les deux apps et `/api/health` est accessible depuis le frontend via `/api/health`.
- **Dépendances** : T1.3

### T1.5 Étendre la configuration TypeScript / ESLint aux apps
- Créer `apps/api/tsconfig.json` et `apps/web/tsconfig.json` héritant de la config racine.
- Étendre `eslint.config.js` pour inclure `apps/*/src`.
- **Skills** : `code-review-and-quality`
- **Fichiers impactés** : `tsconfig.json`, `apps/api/tsconfig.json`, `apps/web/tsconfig.json`, `eslint.config.js`
- **Critère d'acceptation** : `npm run typecheck` et `npm run lint` passent sur les nouvelles apps.
- **Dépendances** : T1.3

---

## Phase 2 — Backend / API locale

### T2.1 Couche de persistence (`ProjectStore`, `SourceStore`, `UnitStore`)
- Implémenter des services qui encapsulent `FileStateManager` et `FileRegistry` pour lire/écrire les entités.
- Conventions de chemins : `.auto-essay/{projectId}/project.json`, `sources.json`, `units.json`, `essay_state.json`.
- Garantir l'atomicité : écriture dans un fichier temporaire puis rename.
- **Skills** : `api-and-interface-design`, `test-driven-development`
- **Fichiers impactés** : `apps/api/src/services/projectStore.ts`, `apps/api/src/services/sourceStore.ts`, `apps/api/src/services/unitStore.ts`
- **Critère d'acceptation** : tests unitaires des stores passent ; création/liste/récupération/mise à jour fonctionnent avec un dossier temporaire.
- **Dépendances** : T1.1

### T2.2 Routes CRUD projets
- `GET /api/projects` — liste avec `ProjectListItemSchema`.
- `POST /api/projects` — création via `CreateProjectBodySchema`.
- `GET /api/projects/:projectId` — détail.
- `PATCH /api/projects/:projectId` — mise à jour titre, thèse, carte argumentative, voix.
- `DELETE /api/projects/:projectId` — suppression.
- **Skills** : `api-and-interface-design`, `test-driven-development`
- **Fichiers impactés** : `apps/api/src/routes/projects.ts`, `apps/api/src/schemas/projects.ts`, `apps/api/src/app.ts`
- **Critère d'acceptation** : tests Vitest couvrent les 5 endpoints avec validation Zod.
- **Dépendances** : T2.1

### T2.3 Import de sources Markdown et BibTeX
- `POST /api/projects/:projectId/sources/import`.
- Réutiliser `importMarkdownFiles` et `importBibTeX` de `@auto-essay/core`.
- Retour structuré `{ imported, errors }`.
- **Skills** : `api-and-interface-design`, `test-driven-development`
- **Fichiers impactés** : `apps/api/src/routes/sources.ts`, `apps/api/src/schemas/sources.ts`, `apps/api/src/services/importService.ts`
- **Critère d'acceptation** : un fixture `.md` et un fixture `.bib` produisent les sources attendues avec erreurs isolées.
- **Dépendances** : T2.1

### T2.4 CRUD sources et annotations
- `GET /api/projects/:projectId/sources`, `GET /api/projects/:projectId/sources/:sourceId`, `PATCH /api/projects/:projectId/sources/:sourceId`, `DELETE ...`.
- Endpoints annotations : `POST .../annotations`, `PATCH .../annotations/:annotationId`, `DELETE .../annotations/:annotationId`.
- **Skills** : `api-and-interface-design`, `test-driven-development`
- **Fichiers impactés** : `apps/api/src/routes/sources.ts`, `apps/api/src/schemas/sources.ts`
- **Critère d'acceptation** : CRUD complet testé ; métadonnées `regime`, `position`, `epistemicLimits` persistées.
- **Dépendances** : T2.3

### T2.5 CRUD unités de rédaction
- `GET /api/projects/:projectId/units` — liste `UnitListItemSchema`.
- `POST /api/projects/:projectId/units` — création via `CreateUnitBodySchema`.
- `GET /api/projects/:projectId/units/:unitId`.
- `PATCH /api/projects/:projectId/units/:unitId` — mise à jour contenu, statut, `targetWordCount`.
- `DELETE /api/projects/:projectId/units/:unitId`.
- **Skills** : `api-and-interface-design`, `test-driven-development`
- **Fichiers impactés** : `apps/api/src/routes/units.ts`, `apps/api/src/schemas/units.ts`, `apps/api/src/app.ts`
- **Critère d'acceptation** : tests unitaires passent ; wordCount renvoyé dans la liste est cohérent.
- **Dépendances** : T2.1

### T2.6 Adaptateur provider LLM
- Implémenter `StructuredModelClient` OpenAI-compatible (`apps/api/src/llm/openAiClient.ts`).
- Gestion de `OPENAI_API_KEY` / `OPENAI_BASE_URL` / modèle via variables d'environnement.
- Fallback mock pour les tests (`apps/api/src/llm/mockClient.ts`).
- **Skills** : `api-and-interface-design`, `test-driven-development`
- **Fichiers impactés** : `apps/api/src/llm/openAiClient.ts`, `apps/api/src/llm/mockClient.ts`, `apps/api/src/env.ts`
- **Critère d'acceptation** : mock retourne un JSON valide ; client réel n'est appelé que si une clé est fournie.
- **Dépendances** : T1.1

### T2.7 Endpoint génération de paragraphe / section
- `POST /api/projects/:projectId/units/:unitId/generate`.
- Orchestrer `ParagraphGenerator` ou `SectionGenerator` selon `mode`.
- Persister la nouvelle version de l'unité.
- **Skills** : `api-and-interface-design`, `test-driven-development`
- **Fichiers impactés** : `apps/api/src/routes/generate.ts`, `apps/api/src/services/generationService.ts`
- **Critère d'acceptation** : avec le mock LLM, un appel génère un `DraftUnit` dont le contenu respecte les contraintes du schéma.
- **Dépendances** : T2.5, T2.6

### T2.8 Endpoint révision par chat + SSE
- `POST /api/projects/:projectId/units/:unitId/revise-chat`.
- `POST /api/projects/:projectId/units/:unitId/revise-chat-stream` (Server-Sent Events).
- Créer un service `ReviseChatService` qui construit un prompt de révision à partir du `DraftUnit`, de l'instruction utilisateur et des claims/citations à préserver.
- Générer un diff `before/after` et une nouvelle version d'unité.
- **Skills** : `api-and-interface-design`, `test-driven-development`
- **Fichiers impactés** : `apps/api/src/routes/reviseChat.ts`, `apps/api/src/services/reviseChatService.ts`
- **Critère d'acceptation** : une instruction de test retourne un diff non vide et une unité en version incrémentée ; le streaming émet `thinking`, `chunk`, `done`.
- **Dépendances** : T2.5, T2.6

### T2.9 Endpoints évaluation et brief
- `POST /api/projects/:projectId/units/:unitId/evaluate` — retourne `EvaluateResponseSchema`.
- `POST /api/projects/:projectId/units/:unitId/brief` — retourne `BriefResponseSchema`.
- Réutiliser `EssayEvaluator` et `RevisionBriefGenerator`.
- **Skills** : `api-and-interface-design`, `test-driven-development`
- **Fichiers impactés** : `apps/api/src/routes/evaluate.ts`, `apps/api/src/services/evaluationService.ts`
- **Critère d'acceptation** : tests avec mock LLM couvrent le verdict `revise` et la présence des `mechanicalIssues`.
- **Dépendances** : T2.5, T2.6, T2.4

### T2.10 Endpoint export Markdown avec bibliographie
- `POST /api/projects/:projectId/export`.
- Implémenter `markdownExport.ts` dans `@auto-essay/core` : concaténation des unités sélectionnées + bibliographie déduite des `sourceIds` réellement cités/utilisés.
- Retour `ExportResponseSchema`.
- **Skills** : `api-and-interface-design`, `test-driven-development`
- **Fichiers impactés** : `src/export/markdownExport.ts`, `src/export/index.ts`, `src/index.ts`, `apps/api/src/routes/export.ts`
- **Critère d'acceptation** : fixture d'export produit un Markdown attendu avec seulement les sources utilisées dans les unités.
- **Dépendances** : T2.5, T2.4

### T2.11 Middleware validation Zod et gestion d'erreurs
- Middleware Hono de validation Zod sur body/param/query.
- Handler d'erreur retournant `{ error, message }` structuré et status adapté.
- CORS permissif pour le dev.
- **Skills** : `api-and-interface-design`, `code-review-and-quality`
- **Fichiers impactés** : `apps/api/src/middleware/validate.ts`, `apps/api/src/middleware/errorHandler.ts`, `apps/api/src/app.ts`
- **Critère d'acceptation** : envoi d'un body invalide retourne `400` avec un message Zod lisible.
- **Dépendances** : T2.2, T2.4, T2.5

---

## Phase 3 — Frontend

### T3.1 Routing et layout de base
- Configurer React Router (`BrowserRouter`) avec routes `/`, `/projects/:projectId`, `/projects/:projectId/sources`, `/projects/:projectId/editor`, `/projects/:projectId/evaluate/:unitId`.
- Layout avec sidebar de navigation et zone de contenu principale.
- **Skills** : `frontend-ui-engineering`, `using-agent-skills`
- **Fichiers impactés** : `apps/web/src/main.tsx`, `apps/web/src/App.tsx`, `apps/web/src/routes/*`, `apps/web/src/components/layout/AppShell.tsx`
- **Critère d'acceptation** : navigation entre les routes fonctionne sans rechargement complet.
- **Dépendances** : T1.2

### T3.2 Écran d'accueil et liste des projets
- Page `/` : liste des projets locaux, bouton "Nouveau projet", suppression.
- Appels à `GET /api/projects` et `DELETE /api/projects/:id`.
- **Skills** : `frontend-ui-engineering`, `test-driven-development`
- **Fichiers impactés** : `apps/web/src/routes/HomePage.tsx`, `apps/web/src/api/projects.ts`, `apps/web/src/hooks/useProjects.ts`
- **Critère d'acceptation** : créer un projet depuis l'UI le fait apparaître dans la liste.
- **Dépendances** : T2.2, T3.1

### T3.3 Formulaire projet et carte argumentative
- Page `/projects/:projectId` : édition du titre, `thesisSeed`, `contextScope`, `voiceConfig`.
- Éditeur visuel de la carte argumentative (sections, transitions, dettes documentaires).
- **Skills** : `frontend-ui-engineering`, `test-driven-development`
- **Fichiers impactés** : `apps/web/src/routes/ProjectPage.tsx`, `apps/web/src/components/project/*`, `apps/web/src/api/projects.ts`
- **Critère d'acceptation** : modification sauvegardée et rechargée correctement.
- **Dépendances** : T2.2, T3.2

### T3.4 Gestionnaire de sources
- Page `/projects/:projectId/sources`.
- Drag-and-drop / file picker pour `.md` et `.bib`.
- Tableau des sources avec édition inline des métadonnées (`regime`, `position`, `epistemicLimits`).
- Panneau d'annotations (surlignage, notes, tags, page range).
- **Skills** : `frontend-ui-engineering`, `test-driven-development`
- **Fichiers impactés** : `apps/web/src/routes/SourcesPage.tsx`, `apps/web/src/components/sources/*`, `apps/web/src/api/sources.ts`
- **Critère d'acceptation** : import d'un fixture depuis l'UI ; modification d'une métadonnée persiste au rechargement.
- **Dépendances** : T2.3, T2.4, T3.1

### T3.5 Éditeur de manuscrit
- Page `/projects/:projectId/editor`.
- Liste des `DraftUnit` par section ; affichage du contenu.
- Sélection d'un paragraphe déclenche le chat contextuel.
- Bouton "Nouvelle unité".
- **Skills** : `frontend-ui-engineering`, `test-driven-development`
- **Fichiers impactés** : `apps/web/src/routes/EditorPage.tsx`, `apps/web/src/components/editor/*`, `apps/web/src/api/units.ts`
- **Critère d'acceptation** : affichage de toutes les unités d'un projet ; sélection d'une unité transmet son ID au panneau chat.
- **Dépendances** : T2.5, T3.1

### T3.6 Panneau de génération
- Dans l'éditeur : sélection de sources/citations pour constituer l'`EvidencePack`.
- Bouton "Générer" appelant `POST /api/projects/:projectId/units/:unitId/generate`.
- Affichage du résultat et des traces (`transformationTraceIds`, `appliedDecisionIds`).
- **Skills** : `frontend-ui-engineering`, `test-driven-development`
- **Fichiers impactés** : `apps/web/src/components/editor/GenerationPanel.tsx`, `apps/web/src/api/generate.ts`
- **Critère d'acceptation** : génération d'un paragraphe depuis l'UI met à jour le contenu de l'unité affichée.
- **Dépendances** : T2.7, T3.5

### T3.7 Barre de chat contextuelle
- Composant latéral qui se charge quand une unité est sélectionnée.
- Input de message, affichage streaming, diff avant/après, boutons Accepter / Rejeter.
- Appel à `/revise-chat-stream`.
- **Skills** : `frontend-ui-engineering`, `test-driven-development`
- **Fichiers impactés** : `apps/web/src/components/editor/ChatPanel.tsx`, `apps/web/src/api/reviseChat.ts`, `apps/web/src/hooks/useChatStream.ts`
- **Critère d'acceptation** : envoi d'une instruction affiche la réponse streamée puis le diff ; accepter met à jour l'unité avec une nouvelle version.
- **Dépendances** : T2.8, T3.5

### T3.8 Tableau d'évaluation
- Page `/projects/:projectId/evaluate/:unitId`.
- Affichage des scores par dimension, des `mechanicalIssues`, du verdict, du brief.
- Bouton "Marquer comme vérifié".
- **Skills** : `frontend-ui-engineering`, `test-driven-development`
- **Fichiers impactés** : `apps/web/src/routes/EvaluatePage.tsx`, `apps/web/src/components/evaluation/*`, `apps/web/src/api/evaluate.ts`
- **Critère d'acceptation** : évaluation d'une unité affiche les scores et le brief ; le statut passe à `verified`.
- **Dépendances** : T2.9, T3.1

### T3.9 Export UI
- Bouton "Exporter" dans l'éditeur.
- Choix des unités (toutes par défaut) et format Markdown.
- Téléchargement du fichier `.md`.
- **Skills** : `frontend-ui-engineering`, `test-driven-development`
- **Fichiers impactés** : `apps/web/src/components/editor/ExportDialog.tsx`, `apps/web/src/api/export.ts`
- **Critère d'acceptation** : export depuis l'UI télécharge un fichier Markdown contenant le contenu et la bibliographie.
- **Dépendances** : T2.10, T3.5

---

## Phase 4 — Tests et intégration

### T4.1 Tests des handlers API
- Tests Vitest pour tous les endpoints critiques (mock du LLM, répertoire temporaire).
- Objectif : couvrir les chemins critiques (CRUD, import, génération, évaluation, export).
- **Skills** : `test-driven-development`, `verification-before-completion`
- **Fichiers impactés** : `apps/api/tests/**/*.test.ts`
- **Critère d'acceptation** : `npm run test:api` passe avec ≥ 80 % des chemins critiques couverts.
- **Dépendances** : Phase 2

### T4.2 Tests des composants frontend
- Tests React Testing Library pour les composants métiers (liste projets, formulaire, chat, évaluation).
- Mock des appels API avec MSW.
- **Skills** : `test-driven-development`, `frontend-ui-engineering`
- **Fichiers impactés** : `apps/web/src/**/*.test.tsx`
- **Critère d'acceptation** : `npm run test:web` passe.
- **Dépendances** : Phase 3

### T4.3 Tests d'intégration / scénarios complets
- Scénarios manuels ou automatisés end-to-end pour les flux A à E de la spec.
- Vérification que les données restent dans `.auto-essay`.
- **Skills** : `verification-before-completion`, `test-driven-development`
- **Fichiers impactés** : `docs/superpowers/plans/beta-frontend-test-scenarios.md` (si créé)
- **Critère d'acceptation** : les 5 scénarios principaux passent manuellement sans erreur.
- **Dépendances** : T4.1, T4.2

### T4.4 Intégration continue
- Mettre à jour le workflow GitHub Actions pour builder, typechecker, linter et tester `apps/api` et `apps/web`.
- **Skills** : `ci-cd-and-automation`
- **Fichiers impactés** : `.github/workflows/*.yml`
- **Critère d'acceptation** : la CI passe sur la branche de la beta.
- **Dépendances** : T1.5, T4.1, T4.2

---

## Phase 5 — Revue et simplification

### T5.1 Revue de code qualité
- Audit du code backend/frontend : conventions, duplication, gestion d'erreurs.
- Vérifier qu'aucune logique métier n'a été ajoutée dans l'API au-delà de parse/valider/appeler.
- **Skills** : `code-review-and-quality`, `code-simplification`
- **Fichiers impactés** : `apps/api/src/**/*.ts`, `apps/web/src/**/*.ts`, `apps/web/src/**/*.tsx`
- **Critère d'acceptation** : `npm run lint` et `npm run typecheck` passent sans warning ; aucune fonction métier dupliquée.
- **Dépendances** : Phase 3

### T5.2 Simplification UI
- Retirer tout élément non essentiel au MVP (pas d'édition riche, pas de fonctionnalités hors scope).
- Harmoniser la nomenclature avec le domaine (`DraftUnit`, `Source`, `Claim`, etc.).
- **Skills** : `code-simplification`, `frontend-ui-engineering`
- **Fichiers impactés** : `apps/web/src/components/**/*`, `apps/web/src/routes/**/*`
- **Critère d'acceptation** : l'interface ne comporte que les écrans projets, sources, éditeur, évaluation.
- **Dépendances** : T5.1

### T5.3 Accessibilité et responsive
- Vérifier les contrastes, navigation clavier, labels ARIA.
- S'assurer que l'interface reste utilisable sur un écran 13".
- **Skills** : `frontend-ui-engineering`
- **Fichiers impactés** : `apps/web/src/components/**/*`, `apps/web/src/index.css`
- **Critère d'acceptation** : audit Lighthouse accessibilité ≥ 90.
- **Dépendances** : T5.2

### T5.4 Documentation
- Mettre à jour `README.md` avec les instructions de démarrage (`npm install`, `npm run dev`, `OPENAI_API_KEY`).
- ADR si passage à un workspace npm/apps est justifié.
- **Skills** : `documentation-and-adrs`
- **Fichiers impactés** : `README.md`, `docs/adr/adr-004-beta-frontend-workspace.md`, `docs/superpowers/plans/beta-frontend-tasks.md`
- **Critère d'acceptation** : un nouveau contributeur peut lancer l'app en 5 minutes.
- **Dépendances** : T5.3

---

## Phase 6 — Ship

### T6.1 Commits atomiques et branche de release
- Commits par phase/groupes de tâches (bootstrap, backend, frontend, tests, docs).
- Branche `feat/beta-frontend`.
- **Skills** : `git-workflow-and-versioning`
- **Fichiers impactés** : historique git
- **Critère d'acceptation** : `git log` montre une histoire lisible.
- **Dépendances** : Phase 5

### T6.2 Pull request et vérification CI
- Créer la PR avec description des changements et checklist de tests.
- Vérifier que tous les checks passent.
- **Skills** : `code-review-and-quality`, `verification-before-completion`
- **Fichiers impactés** : PR GitHub
- **Critère d'acceptation** : CI verte, au moins une revue approuvée.
- **Dépendances** : T6.1

### T6.3 Merge et tag beta
- Merge dans `feat/init-core-engine` (ou branche cible définie par l'équipe) puis tag `v0.2.0-beta`.
- **Skills** : `git-workflow-and-versioning`, `shipping-and-launch`
- **Fichiers impactés** : git tags
- **Critère d'acceptation** : tag créé et `npm run typecheck && npm test && npm run demo:synthetic && npm run demo:station-reverse` passent sur la branche cible.
- **Dépendances** : T6.2

---

## Traçabilité étapes → livrables → vérification

| Étape | Livrable cible | Vérification |
|-------|----------------|--------------|
| 1. Bootstrap | `apps/web/`, `apps/api/`, workspace root | `npm run dev` ouvre l'UI et `GET /api/health` répond |
| 2. CRUD projets | routes + stores | tests Vitest passent |
| 3. Ingestion sources | endpoint + UI d'import | test `POST /api/projects/:id/sources/import` |
| 4. Éditeur + génération | UI + service génération | scénario manuel complet |
| 5. Chat contextuel | endpoint SSE + panneau | test streaming + acceptation diff |
| 6. Évaluation | endpoints + UI | tests + vérification scores |
| 7. Export Markdown | endpoint + UI | comparaison avec fixture attendue |
| 8. Intégrité | suite complète | `typecheck && test && demos` passent |

---

## Points de vigilance

- **Pas de nouvel objet canonique** : le backend ne fait que parser, valider (Zod) et déléguer au moteur.
- **Offline-first** : toutes les données restent dans `.auto-essay` ; seuls les appels LLM nécessitent Internet.
- **Scope MVP** : pas d'export DOCX, pas de PWA, pas de SaaS, pas de collaboration.
- **Sécurité** : jamais d'`eval` côté client ; validation stricte Zod côté serveur ; variables d'environnement pour les clés LLM.
