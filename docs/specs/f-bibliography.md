# Chantier F — Bibliothèque : ingestion, distribution, citation

## Objectif

Faire d'Autoessay un moteur qui construit une pensée à partir d'une bibliothèque.
Le brief impose une frontière stricte :

> **Graphify sait lire et connecter la bibliothèque. Autoessay lui donne un sens.
> Diffract transforme ce sens en pensée et en écriture. Agent Memory se souvient
> du chemin.**

## Les trois fonctions (énoncées par l'auteur)

1. **Analyse de corpus (de zéro)** — on ingère un corpus et on fait émerger les
   sujets possibles.
2. **Distribution** — on a un manuscrit + un plan ; l'ingestion distribue les
   éléments qui répondent aux chapitres / paragraphes.
3. **Citation classique** — citer proprement dans le texte.

## Contraintes transverses

- **Ne pas cramer de tokens** : la base peut être conséquente. Le moteur ne doit
  jamais charger le corpus (ni le full-text) dans un contexte.
- **Diffraction organique** : quand on diffracte, la distribution bibliographie
  peut se modifier (re-projection, pas de mutation destructive).
- **Graphify** : l'infra de graphe est interrogée par Diffract pour trouver des
  liens inédits / faire des rapprochements.

## Principe directeur : le moteur connaît des types, pas des instances

La bibliothèque est de la **donnée**. Le moteur lit uniquement :
- les **métadonnées** d'une source (auteur, titre, année, type),
- son **profil sémantique compact** (`subjects`, `concepts`, `abstract`),
- le **sous-graphe pertinent** du scope en cours.

Tout le reste est traité par des **projections pures** (zéro token), exactement
comme `projectBookState` / `projectBookPlan`.

## Décisions actées (réponses de l'auteur)

1. **La base** : surtout `.md` et `.pdf` — le corpus réel est organisé en
   **12 chapitres** (12 dossiers : `Jews in space`, `Star trek`, `Afro juif`,
   `US Jews`, `White passing`, `Mondes parallèles`, `Mythologie et religion`,
   `Philosophie & diaspora`, `Jew fantasy`, `Atantic juif`, `1492`,
   `Plan et suggestion IA`). Graphify ingère les deux formats nativement.
2. **Graphify** : à **installer** (fait : venv `.venv` + package + paquet
   `openai`) ; **forker seulement si** l'ontologie générique doit être resserrée
   (arêtes « sujet partagé » spécifiques au manuscrit).
3. **Les sujets** : **non déterministe** — c'est le cœur (voir section suivante).

## Génération des sujets (non déterministe — le cœur du chantier)

La proposition de sujets n'est pas un matching, c'est un **acte génératif**,
le même geste que la diffraction : générer large, puis qualifier contre la
matière, avec trace.

1. **Réduction en « paysage »** — Graphify ingère le corpus → nœuds
   (concepts, entités, sources) + arêtes taguées + communautés + god nodes +
   `surprising_connections`. C'est la *matière structurée*, pas la sémantique.
2. **Génération de sujets candidats** — Autoessay pose au modèle les questions
   du brief (des *générateurs*, pas des recherches) : quelles idées traversent
   plusieurs ouvrages ? où les auteurs se rejoignent / se contredisent ? quelles
   tensions restent irrésolues ? quels concepts servent de ponts ?
   → chaque réponse produit des **sujets candidats** (des formulations de
   thèmes, pas des mots-clés).
3. **Qualification contre le graphe** — chaque sujet candidat est diffracté
   contre le graphe : est-il soutenu ? par quelles sources ? (provenance :
   nœuds + `source_location` + confiance). Un sujet gagne des **preuves** ou
   tombe. Génération stochastique large + qualification structurelle (gratuite)
   = le partage Graphify/Autoessay du brief.
4. **Le sujet devient un scope** — un sujet retenu devient un nœud/scope
   potentiel du manuscrit (même type que `sectionId`/`paragraphId`). Donc
   « proposer des sujets de zéro » et « distribuer vers un plan existant »
   sont **la même opération à deux moments**.

La **nouveauté** vient de la confrontation des profils entre eux (chemins,
communautés, ponts) — pas de la lecture isolée de chaque source.

## Graphify — branchement réel (opérationnel, vérifié)

- CLI 0.7.15 : la sous-commande headless est
  `python -m graphify extract <path> --backend ollama --model <m> --token-budget N --max-concurrency 1 --api-timeout 900`
- Backend **ollama** : `OLLAMA_BASE_URL` (défaut `http://localhost:11434/v1`),
  `OLLAMA_MODEL` (défaut `qwen2.5-coder:7b`), `OLLAMA_API_KEY`,
  `GRAPHIFY_OLLAMA_NUM_CTX` (défaut 2048 — à augmenter), `GRAPHIFY_MAX_OUTPUT_TOKENS`.
- **Branchement Ollama Cloud de l'auteur** : `OLLAMA_BASE_URL=https://ollama.com/v1`
  (endpoint OpenAI-compatible vérifié), `OLLAMA_MODEL=mistral-large-3:675b`,
  clé dans `apps/api/.env` (jamais commitée, jamais affichée).
- Sorties : `graphify-out/` → `graph.json` (nœuds/arêtes), analyses,
  communautés ; `extract` est headless (pas de rapport HTML).

## Leçons opérationnelles du run réel (chapitre « Jews in space »)

- **Chunks trop gros → couverture effondrée** : avec ~18 fichiers/chunk, le
  modèle ne couvre que les 2-3 premiers fichiers du chunk. Avec des chunks de
  ~4-5 fichiers (`--token-budget 20000`), la couverture passe à 33/37 fichiers
  et les nœuds deviennent majoritairement des **concepts** (223/251) plutôt
  que des personnes. La sortie est ~8× plus riche à coût d'entrée comparable.
- **Cache par hash opaque** : le cache (`graphify-out/cache/semantic/*.json`)
  est indexé par un hash qui n'est pas le SHA-256 direct du fichier source →
  **non portable** entre dossiers. Ne pas tenter de le copier.
- **Manifest trompeur** : après un run partiel (chunk échoué), le manifest
  marque les fichiers « cached/unchanged » → un re-run incrémental ne
  re-extrait RIEN. Pour forcer : purger `graphify-out/` avant de relancer.
- **503 ponctuels** (`model temporarily overloaded`) sur Ollama Cloud : le
  chunk échoue mais le run continue ; relancer corrige. `--max-concurrency 1`
  réduit la fréquence.
- **Prix** : le pricing graphify du backend ollama affiche $0.00 (coût réel sur
  le quota cloud de l'auteur).

## Architecture Autoessay (stockage canonique, JSON projet)

- `Source` (existant) — métadonnées bibliographiques.
- `SourceProfile` (nouveau) — `{ sourceId, subjects: string[], concepts: string[], abstract }`.
  Le profil est ce que le moteur lit, jamais le texte intégral.
- `library.json` (nouveau) — l'index : `{ sources, profiles }`.
- `BibliographyDistribution` (nouveau) — liens `{ sourceId, scopeId, rationale? }`,
  où `scopeId` est un **id de nœud** (chapitre ou paragraphe), cohérent avec
  `EditorialScope` (ADR-006).

## Découpage en tickets

- **F0** ingestion + profils (`library.json`, par lots ~20 sources/appel,
  incrémental)
- **F1** distribution (`distributeBibliography` + `projectBibliography`)
- **F2** citation classique reliée à la distribution
- **F3** diffraction organique (`bibliographyImpacts`)
- **F4** pont Graphify (populate + round-trip + frontière sémantique)

## État d'avancement (ingestion réelle)

Le chapitre « Jews in space » (253 fichiers segmentés : 8 livres, 4 exports
Zotero, 3 transcriptions) est en cours d'ingestion sur Ollama Cloud. Les autres
chapitres (12 au total) suivront avec `--update` incrémental.