# Frontend — état et backlog différé

## État actuel

Le chantier du workspace centré sur le scope (#237–#244) est terminé.

Le workspace principal couvre désormais :

- navigation hiérarchique du manuscrit par scope ;
- conversation située minimale ;
- contexte et sources inspectables ;
- Plan V2 dans le scope chapitre ;
- lectures Diffract attachées aux décisions de structure ;
- entrée projet hybride manuscrit / plan / bibliographie ;
- composition mobile du workspace avec manuscrit prioritaire, docks ouvrables, `Escape`, `aria-current` et focus visibles.

Ces capacités constituent l’état de référence du frontend. Elles ne doivent pas être réimplémentées dans un autre parcours.

## Chantier #153 — reporté

La spec #153 « rendre le parcours frontend mobile, reconnaissable et cohérent » est conservée comme backlog mais n’est pas prioritaire.

Tout ce qui a déjà été livré par #244 a été retiré de son périmètre. Il reste seulement :

1. **#154 — shell global mobile** : adapter l’`AppShell` existant sur petit écran et conserver la bonne matière active sur les routes temporaires ;
2. **#155 — sélection depuis la structure** : supprimer les saisies libres d’ID comme entrée principale dans Plan/Lectures en réutilisant la projection hiérarchique existante, sans nouveau sélecteur métier, nouvelle API, second Plan V2 ou second workspace Diffract ;
3. **#156 — clarté/accessibilité hors workspace** : labels explicites, états vides, erreurs, contrôles d’import et actions de reprise.

### Ce qui est explicitement hors périmètre de #153

Les éléments suivants sont déjà livrés par #244 et ne doivent pas être rejoués :

- responsive interne du workspace ;
- manuscrit prioritaire sur petit écran ;
- navigation et contexte sous forme de docks ;
- exclusivité des docks ;
- fermeture après sélection de scope ;
- retour au manuscrit avec `Escape` ;
- `aria-current` du scope actif ;
- gestion du focus dans le workspace ;
- propositions et révision en composition compacte.

## Statut opérationnel

#153, #154, #155 et #156 restent ouverts uniquement comme mémoire de backlog.

Ils ne portent plus le label `ready-for-agent` et ne doivent pas être lancés avant une repriorisation explicite.

Ordre recommandé lors de la reprise :

`#154 → #155 (scope réduit) → #156 → fermeture #153`

## Garde-fous de reprise

- aucun changement du core ou du modèle métier ;
- aucune nouvelle API ;
- aucune seconde projection/navigation du manuscrit ;
- aucun `MobileAppShell` parallèle ;
- aucun second Plan V2 ;
- aucun second workspace Diffract ;
- conserver les routes publiques existantes ;
- privilégier composition, déduction et réemploi des composants déjà présents.
