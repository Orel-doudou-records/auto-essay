# Démo distribuable — lecture diffractive du chapitre 2 (bibliothèque graphifiée)

Une démo autonome du moteur de pensée auto-essay : tu poses un fragment dans
le chapitre 2 (« Le salon ») du projet Judéofuturisme, et tu reçois la lecture
diffractive complète — quatre passes, verdict, impacts sur le plan et sur la
bibliographie — nourrie par le **graphe de corpus** (bibliothèque du chapitre 2
graphifiée, corpus « Jews in space »).

## Prérequis

- Node.js 20+ (utilise le Node 22 du projet).
- Une clé API **Ollama Cloud** (le moteur appelle `mistral-large-3:675b` par
  défaut). Tu peux la récupérer sur <https://ollama.com/settings/keys>. Sans
  clé, l'API retombe sur un client simulé (mock : lecture déterministe).

## Lancer

```bash
npm install
# 1. renseigne ta clé (le .env est déjà présent pour l'API)
#    OLLAMA_API_KEY=...  dans apps/api/.env
# 2. lance l'API + le web
npm run dev          # API sur http://localhost:3000, web sur http://localhost:5173
```

Ouvre **http://localhost:5173/demo** (lien « Démo » dans la barre latérale).

Coût : ~1 lecture = 1 appel au modèle (~10-20 k tokens selon la taille du
contexte). Budget de voisinage : 9 termes × BFS depth 2 / 30 nœuds = voisinages
~70 nœuds / 70 arêtes envoyés tels quels (zéro token d'extraction).

## Parcours de la démo

1. La page charge `GET /api/demo/judeofuturisme` : l'**état du livre** projeté
   depuis le manuscrit (Acte I verified, Acte II en ébauche, Acte III planifié),
   le plan du chapitre 2 (16 entrées, du salon à l'anecdote de Brooks), les
   concepts/tensions, la bibliothèque du chapitre (27 sources) et les
   **voisinages du graphe** autour des termes du chapitre.
2. Écris un fragment ou clique un fragment suggéré (ils viennent du plan :
   chap2-14/16 Star Trek et Brooks, chap2-09 Asimov/Gernsback/Russ, chap2-12
   Superman, chap2-06 la transition de l'accident).
3. `POST /api/diffract` exécute la lecture diffractive **avec** la bibliothèque
   et les signaux du graphe dans le prompt. La lecture répond : les 4 passes,
   le verdict forcé, la matrice de compromis, `planImpacts` et
   `bibliographyImpacts` — les rapprochements entre sources que le graphe
   suggère et que le lecteur qualifie.

## Architecture (ce que la démo exerce)

```
web (DemoPage)  →  GET /api/demo/judeofuturisme   →  contexte prêt à poster
                →  POST /api/diffract             →  DiffractionService
                                                     └─ DiffractivePipeline.diffract
                                                        └─ DiffractiveReader
                                                           ├─ prompt : état du livre
                                                           │  + plan + bibliothèque
                                                           │  + « Signaux du graphe »
                                                           └─ Ollama (675B) → lecture
```

- **Contexte sans I/O côté client** : la projection `projectBookState`
  (manuscrit → parties avec statut) et les voisinages `buildGraphNeighborhoods`
  sont calculés côté serveur, une fois (`apps/api/src/services/demoService.ts`).
- **Le graphe suggère, la lecture qualifie** : les voisinages (BFS budgété,
  zéro token) entrent dans le prompt comme signaux candidats ; le lecteur les
  accepte/transforme/rejette dans `bibliographyImpacts` (F3/F4 + G1).
- **Assets embarqués** : `apps/api/src/demo/judeofuturisme/` — copie figée des
  données d'exemple (manuscrit, unités, plan, concepts, tensions,
  bibliothèque + sous-graphe). L'original vivant est
  `examples/judeofuturisme/` (le sous-graphe se régénère avec
  `build-graph-chap2.mjs` depuis le `graph.json` fusionné du corpus).

## Vérifier sans le web

```bash
# contexte de démo
curl http://localhost:3000/api/demo/judeofuturisme

# lecture diffractive (fragment suggéré chap2-14/16)
curl -X POST http://localhost:3000/api/diffract \
  -H "Content-Type: application/json" \
  -d '{"statement":"Le vaisseau est un salon : la SF juive ne met pas les juifs dans les étoiles, elle met l'\''étoile dans la cabine, et la cabine est une diaspora qui continue."}'
```

Pour envoyer le contexte complet en une requête (sans la page web) : récupère
le JSON de `/api/demo/judeofuturisme`, ajoute `"statement": "…"` dans
`context`… plus simple : la page web le fait pour toi.

## Limites connues

- La démo consomme le quota Ollama Cloud de la machine qui la lance (pas de clé
  embarquée : chacun met la sienne).
- Les fragments suggérés sont illustratifs (inventés pour la démo), pas des
  extraits du manuscrit.
- Un impact `manquante` peut porter un `sourceId` placeholder (« manquante ») :
  toléré par le schéma, à resserrer si besoin.