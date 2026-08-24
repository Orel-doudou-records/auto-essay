# F0 — Ingestion + profils sémantiques (library.json)

## Contexte

Le corpus réel est ingéré par Graphify (graphe), mais Autoessay a besoin de sa
propre couche sémantique canonique : un index compact que le moteur peut lire
sans jamais charger le corpus. `importBibTeX` existe déjà pour les `.bib` ; le
corpus réel est en `.md`/`.pdf`/`.ris` (Zotero).

## Objectif

Produire `library.json` — `{ sources: Source[], profiles: SourceProfile[] }` —
par une ingestion **par lots** et **incrémentale**, sans jamais soumettre le
corpus entier à un contexte.

## Changements proposés

- `SourceProfile` (domaine) : `{ sourceId, subjects: string[], concepts: string[], abstract?: string }`
  + schéma zod + factory. Le profil EST ce que le moteur lit.
- `buildProfiles(library, client)` : découpe en lots de ~20 sources, un appel
  LLM structuré par lot (`StructuredClientAdapter` existant) → profils.
- `library.ts` : lecture/écriture de `library.json`, réingestion incrémentale
  (clé stable par source, seules les nouvelles/modifiées sont reprofilées).
- CLI : `npm run ingest` (dans `apps/api`), sortie `library.json`.

## Vérifications

- Tests : schéma + factory (ids valides), découpage en lots, incrémental
  (source inchangée → non reprofilée), échec JSON d'un lot → retry.
- Typecheck complet (core + api) avant merge.
## Statut : ✅ livré (PR #56, merge d16fb8a)

