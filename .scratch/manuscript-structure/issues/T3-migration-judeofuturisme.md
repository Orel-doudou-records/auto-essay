# T3 — Migration judéofuturisme + branchement du projecteur

**Bloqué par :** T2 (projecteur d'état)

## Contexte

Spec D user stories 12–13. L'exemple `examples/judeofuturisme/` (project.json,
run.ts) utilise aujourd'hui des fichiers bookParts JSON faits main ; le modèle
675B est configuré (apps/api/.env, gitignoré).

## Livrable

- Migrer `examples/judeofuturisme/project.json` + `run.ts` vers l'arbre
  `Manuscript` (actes/chapitres/scènes réels du manuscrit, statuts variés :
  au moins une partie `verified`, une `drafting`, une planifiée sans texte).
- `run.ts` / CLI : alimenter le diffract via `projectBookState` (fini les
  fichiers `bookParts` manuels) — les flags `--book-parts`/`--cuts` restent
  disponibles pour un usage ad hoc.
- **Vérification réelle (démo)** : `npm run diffract` (ou diffract-batch) sur
  un fragment avec le manuscrit structuré — le verdict doit être sensible à
  l'ébauche (ex. intégration dans l'Acte II planifié plutôt qu'invention d'un
  « chapitre 2 »), et composer avec les coupes déjà édictées.

## Contrat

`npm run example:judeofuturisme` continue de passer en déterministe
(RelationAnalyzer sans LLM) ; le diffract live reste optionnel (clé Ollama).

## Pièges connus

- Encodage UTF-8 des fichiers d'exemple (accents) : write tool puis Copy-Item.
- Redirection PowerShell `>` = UTF-16 + bannière npm (décoder avant parse).
- Le corpus réel : `.openclaw/tmp/judeofuturisme-extrait.txt` (extrait),
  `examples/judeofuturisme/concepts.json`, `tensions.json`.
## Statut : ✅ livré (commit a5d362b, CI verte ; vérification réelle 675B : integrate_now dans le chap-4 planifié)

