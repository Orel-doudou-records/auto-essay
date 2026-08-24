# T4 — Monter le livre de zéro + écriture paragraphe par paragraphe

**Feature** : book-plan · **Bloqué par** : T2 + T3.

## Objectif
Un manuscrit peut se charger uniquement en chapitres + plan (paragraphes non
écrits) + notes synthétiques ; l'humain ou l'agent rédige paragraphe par
paragraphe, et le paragraphe écrit devient une unité liée (trace conservée).

## Contrat
- Lier une entrée de plan rédigée à une `DraftUnit` (`unitId`+`version` sur
  l'entrée, ou lien nœud→feuille) sans détruire l'entrée (trace).
- Script de démo `examples/judeofuturisme/` : le plan réel (Chap 2 « Le salon →
  Abikou », Chap 3 « George Clinton → L'expérience extra-terrestre ») est
  chargé comme données ; l'agent rédige un paragraphe à la demande.
- README : mode d'emploi « monter de zéro ».

## Démo
Boucle complète sur un chapitre : plan → preview → diffraction → choix d'un
paragraphe → rédaction → lecture plan-aware → unité liée.

## Pièges connus
- Ne pas casser le run.ts existant (projection) ; fichiers de données UTF-8 via
  `write` + `Copy-Item` ; pas de clé/secrets commités.
## Statut : ✅ livré (PR #55, merge 2e4ba70)

