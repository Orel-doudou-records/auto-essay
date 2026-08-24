# Spec E — Plan d'ébauche, notes et lecture plan-aware

**Statut** : brouillon validé par l'auteur (grill rapide, 2026-08-24).
**Précédent** : ADR-006 / spec D (l'arbre du manuscrit).
**Contexte** : le chantier D a fait du manuscrit un arbre de parties. Il manque
la brique « plan » : l'auteur veut renseigner un plan d'ébauche (chapitres →
paragraphes prévus) et que le modèle le consomme pour élaborer un aperçu, le
diffracter, et rédiger paragraphe par paragraphe.

## Problème

Aujourd'hui, un chapitre planifié est un nœud d'arbre **sans** structure
interne : impossible de noter « Chap 2 → Le salon / Le shabbat et la part du
pauvre / … / Abikou et le rêve prémonitoire ». Rien ne relie une décision
d'écriture locale à ses conséquences à distance (un choix au chap 2 peut
affecter le chap 3), et rien ne permet un fil de notes Humain + Agent sur un
paragraphe ou un chapitre.

## User stories

1. **Renseigner un plan** : l'auteur attache à un chapitre la liste ordonnée de
   ses paragraphes prévus (sujets courts), sans écrire le contenu.
2. **Noter / résumer** : sur un chapitre OU un paragraphe de plan, un fil de
   commentaires `{humain | agent}` (idées, résumés synthétiques).
3. **Élaborer un aperçu** : le modèle transforme le plan brut en un `preview`
   par paragraphe (2-3 phrases : « ce que ce paragraphe va dire »).
4. **Diffracter le plan** : le modèle lit le plan en entier (trous, doublons,
   ordre, tensions) et rend un verdict — pas seulement le remplir.
5. **Lecture plan-aware** : quand l'agent lit un paragraphe réel, il voit tout
   le plan ; un choix peut avoir une conséquence plusieurs chapitres plus loin
   → la lecture signale ces impacts à distance.
6. **Monter de zéro** : un manuscrit peut se charger uniquement en chapitres +
   paragraphes non écrits + notes synthétiques ; l'humain ou l'agent rédige
   paragraphe par paragraphe (le paragraphe écrit devient une vraie unité).

## Décisions d'implémentation

- **Le plan vit dans le nœud** : `ManuscriptNode` gagne `plan?: PlanEntry[]`
  (liste ordonnée ; la position est l'ordre, cohérent ADR-006 D10) et
  `notes?: PlanNote[]`. Pas d'objet séparé `BookOutline` : le manuscrit reste
  la seule source de vérité structurelle.
- **`PlanEntry { id, subject, preview?, notes? }`** : `subject` = intitulé
  court ; `preview` = aperçu régénérable produit par le modèle ; `notes` = fil
  humain+agent. Quand le paragraphe est écrit, l'entrée devient une feuille
  (DraftUnit) **liée** par id — l'entrée de plan n'est pas détruite (elle garde
  la trace).
- **`PlanNote { kind: "human"|"agent", text, createdAt }`** : fil de commentaires
  chronologique, sur un nœud ou une entrée de plan.
- **Projection du plan** : le projecteur (`projectBookState`) enrichit la forme
  canonique lue par le diffract d'une section « plan » (`bookPlan`) — les
  paragraphes prévus et leurs notes/preview, dans l'ordre, sans le contenu des
  unités déjà écrites (déjà couvert par `bookParts`).
- **Lecture plan-aware** : `DiffractiveReadingRequest` gagne `bookPlan?` ; le
  prompt reçoit la section « Le plan du livre » ; la lecture peut rendre
  `planImpacts?: [{partId, partTitle, impact}]` (conséquences à distance). Pas
  de nouveau verdict : l'impact s'exprime dans `action`/`planImpacts`.
- **Élaboration + diffraction du plan** : un service appelle le modèle deux
  fois — (1) `plan → preview[]` (JSON structuré), (2) diffraction du plan
  enrichi (même moteur diffractif, entrée = le plan, pas un fragment).
- **Ids** : `PlanEntry.id` unique **au sein du nœud** (pas globalement).

## Testing decisions

- TDD pur sur le domaine : schémas, validation (id dupliqué), factories,
  projecteur du plan, prompts.
- Les nœuds existants (sans `plan`/`notes`) restent valides — rétro-compatible.
- Test de projection : un chapitre avec plan non écrit → `bookPlan` ordonné ;
  un paragraphe écrit (feuille) n'apparaît plus comme « prévu ».
- Les services LLM (preview, diffraction du plan) : tests avec un adaptateur
  fake (pas de modèle réel en CI), + un smoke réel manuel (675B) comme pour D.

## Out of scope

- Éditeur visuel de plan (UI web).
- Synchronisation multi-auteurs / conflits de notes.
- Plan de paragraphe à plusieurs niveaux de profondeur (le plan d'un chapitre
  est une liste plate de paragraphes ; la profondeur libre reste celle de
  l'ARBRE, pas du plan).
