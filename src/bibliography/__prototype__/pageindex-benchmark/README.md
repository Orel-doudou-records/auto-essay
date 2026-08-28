# PROTOTYPE JETABLE — PageIndex ↔ Graphify

Question : PageIndex améliore-t-il suffisamment la matière documentaire
d'Auto Essay pour justifier le retrait de Graphify ? Le prototype ne modifie
aucun objet canonique et ne doit jamais rejoindre la branche principale.

```bash
npm run prototype:pageindex -- --dry-run
npm run prototype:pageindex
```

Pour les bras PDF, copier `manifest.example.json` vers `manifest.local.json`,
associer les `sourceId` aux PDF réels, installer `pageindex`, puis déclarer
explicitement `AUTO_ESSAY_PAGEINDEX_INDEX_MODEL` et
`AUTO_ESSAY_PAGEINDEX_CHAT_MODEL`. Le worker utilise `PageIndexLocalClient` et
refuse l'absence de modèles explicites. L'index jetable est conservé sous
`.scratch/pageindex-prototype-store-WIPE-ME` pour éviter de repayer chaque run.

Dans le terminal : `g` lance Graphify, `b` le préfixe 2 000 caractères, `i`
PageIndex et `r` la revue aveugle. Chaque élément reçoit quatre notes de 0 à 3.
Les extraits PageIndex sont vérifiés contre les pages et marqués
`verified_exact`, `verified_normalized` ou `rejected`.

Après les trois cas, reporter seulement les mesures et l'un des verdicts
`ADOPT`, `SHADOW`, `LIMITED`, `REJECT` dans la future spec.
