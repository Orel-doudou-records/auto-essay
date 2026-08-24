# T3 — Élaboration de l'aperçu (plan preview) + diffraction du plan

**Feature** : book-plan · **Bloqué par** : T1 (T2 recommandé).

## Objectif
Le modèle élabore un `preview` par paragraphe du plan, puis **diffracte le plan
lui-même** (trous, doublons, ordre, tensions) → verdict sur le plan.

## Contrat
- `src/editorial/planPreview.ts` : `elaboratePlanPreview(plan, adapter)` →
  `{ entryId, preview }[]` (JSON structuré via l'adaptateur robuste).
- `diffractPlan(bookPlan, adapter)` → une `DiffractiveReading` dont l'« objet »
  est le plan (réutilise `runDiffract` / le moteur diffractif, pas de fork).
- CLI : `--plan` alimente preview + diffraction ; sortie JSON.

## Démo
Sur le plan du Chap 2 judéofuturisme : preview par paragraphe + verdict du plan
(ex. « la transition “l'accident” ne relie pas “Le coucher” à “La photo” »).

## Pièges connus
- Réutiliser `StructuredClientAdapter` (retry + jsonRepair) ; tests fake en CI,
  smoke réel 675B à part (comme pour D).
## Statut : ✅ livré (PR #54, merge ee64007)

