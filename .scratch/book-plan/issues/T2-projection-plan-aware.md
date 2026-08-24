# T2 — Projection du plan + lecture plan-aware

**Feature** : book-plan · **Bloqué par** : T1.

## Objectif
Le lecteur diffractif connaît le plan : la requête gagne `bookPlan?`, le prompt
reçoit une section « Le plan du livre », et la lecture peut rendre
`planImpacts?` (conséquences à distance d'un choix d'écriture).

## Contrat
- `DiffractiveReadingRequest` gagne `bookPlan?: BookPlanInput[]`
  (`{ partId, partTitle, entries: [{ id, subject, preview?, notes? }] }`)
  + `existingCuts` déjà présents.
- Prompt : section « Le plan du livre » (entrées ordonnées, notes humain/agent
  signalées) ; instruction explicite « un choix peut affecter un élément du plan
  plus loin dans le livre — signale-le ».
- Sortie : `planImpacts?: [{ partId, partTitle, entryId?, impact }]` optionnel.
- Projecteur : `projectBookPlan(manuscript)` → `BookPlanInput[]` (chapitres
  ayant un plan, entrées dans l'ordre ; sans le contenu des feuilles déjà écrites).

## Démo
Lecture diffractive d'un fragment avec le plan du Chap 2 judéofuturisme → la
sortie signale un impact sur « L'errance spatiale… (conclusion) » ou
« George Clinton… » au chap 3.

## Pièges connus
- `formatExistingCut` existe ; ajouter `formatPlanEntry`/`formatPlanPart` sans
  casser le prompt actuel ; tests avec un adaptateur fake (pas de modèle réel).