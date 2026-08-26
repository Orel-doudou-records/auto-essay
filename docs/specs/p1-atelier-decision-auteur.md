# P1 — Atelier de décision auteur

**Statut :** cadrage validé pour découpage, 26 août 2026.  
**Prérequis :** arbre du manuscrit, état du livre en cours, plan d’ébauche, bibliothèque distribuée, lecture diffractive et décisions éditoriales versionnées.

## Intention

Auto Essay sait déjà lire une situation éditoriale : le lecteur diffractif renvoie un verdict, des réfractions, des impacts sur le plan et des signaux bibliographiques. La démo G2 expose ce résultat sur le chapitre 2 du Judéofuturisme. P1 transporte ce chemin vers les projets réels et donne à l’auteur l’acte qui lui revient : rendre une proposition exécutable, la modifier, ou l’écarter.

L’atelier ne remplace aucune règle du moteur. `DiffractiveReading` reste une trace de raisonnement non exécutable. `EditorialDecision` reste la seule autorité éditoriale active. L’interface n’ajoute qu’un lieu où cette frontière devient visible et où l’auteur peut la franchir volontairement.

> Une proposition diffractive n’est jamais appliquée par défaut. Seule une décision validée par l’auteur entre dans les projections d’écriture, d’évaluation et de révision.

## Périmètre du premier jalon

Le premier jalon opère sur une **section** de manuscrit et un **fragment** choisi dans cette section. La section apporte le contexte qui manque à une lecture isolée : l’état des parties du livre, les entrées de plan, les coupes déjà édictées et les sources distribuées. Le fragment demeure l’objet soumis à la lecture.

Cette limite évite deux impasses. Un paragraphe seul efface les conséquences de structure ; un chapitre complet force dès le départ une orchestration longue, coûteuse et difficile à reprendre. P1 prépare cette extension sans la réaliser.

| Élément affiché | Source canonique | Usage dans l’atelier |
| --- | --- | --- |
| Section, plan et état du livre | `Manuscript` et ses projections | Situer le fragment et rendre les conséquences intelligibles. |
| Fragment | Saisie auteur ou référence de `DraftUnit` | Matière de la lecture diffractive. |
| Lecture et verdict | `DiffractiveReading` | Proposition non exécutable, conservée comme trace. |
| Décision active | `EditorialDecision` | Engagement auteur versionné, repris par les projections. |
| Coupe existante | Projection d’une décision active | Contrainte visible durant les lectures suivantes. |
| Sources distribuées | `BibliographyDistribution` et profils de source | Ressources de contexte et pistes de rédaction. |

## Parcours nominal

L’auteur choisit une section et un fragment. L’atelier charge le contexte compact de la section, sans verser le corpus complet dans le prompt. Il exécute une lecture diffractive, puis rend le verdict, les réfractions, les impacts distants sur le plan, les signaux bibliographiques et les coupes déjà actives.

L’auteur dispose de trois actes. Une **validation** accepte les engagements proposés. Une **adaptation** les modifie ; elle exige une note expliquant le changement et crée une décision avec ses propres engagements. Un **refus** archive la lecture et sa proposition sans créer de décision active. Une note est facultative pour la validation et le refus.

Une validation ou une adaptation donne naissance à une `EditorialDecision` active, versionnée et reliée au scope de la section. Lors d’une lecture ultérieure, la décision est projetée parmi les `ExistingCut` afin que le moteur compose avec elle plutôt que de la réinventer. Un refus n’apparaît pas comme contrainte active ; il reste accessible dans l’historique du travail éditorial.

## Règles métier

| Règle | Conséquence vérifiable |
| --- | --- |
| Seul l’auteur valide | Toute création de `EditorialDecision` porte `validatedBy: "author"`. |
| Une candidate ne s’exécute pas | Aucun appel de génération, d’évaluation ou de révision ne reçoit une décision sans statut `active`. |
| L’adaptation est explicite | Une adaptation requiert une note et produit des engagements distincts de la candidate. |
| Le refus ne disparaît pas | La lecture et sa proposition restent consultables avec un résultat de refus ; elles ne deviennent pas une coupe active. |
| Les décisions actives composent les lectures suivantes | Les scopes concernés exposent une `ExistingCut` dérivée de la décision active. |
| Les sources sans profil ne fondent pas une preuve | Elles restent visibles comme pistes, mais ne rejoignent pas automatiquement un `EvidencePack` ni une citation. |
| La rédaction est un acte séparé | Valider ne crée pas de `DraftUnit` et ne lance pas de génération. |

## Sources distribuées et preuve

Une source distribuée peut avoir un profil sémantique complet, un profil partiel ou aucune qualification. L’atelier distingue ces états au lieu de les masquer. Une source sans profil peut éclairer la bibliothèque, ouvrir une piste de recherche ou motiver une future qualification. Elle ne peut pas devenir une preuve de génération automatiquement : l’auteur ou une étape de qualification doit d’abord disposer d’un profil, d’une citation ou d’un extrait approprié.

Cette distinction conserve la frontière du chantier F : la bibliothèque donne une matière structurée ; le moteur ne transforme pas une métadonnée ou un voisinage de graphe en preuve textuelle.

## Reprise et historique

Le scope sélectionné affiche les décisions actives locales, celles héritées de ses ancêtres et les décisions liées à des descendants lorsque l’impact est explicite. Une décision supersédée reste dans l’historique avec son successeur. Une décision révoquée ne règle plus la lecture et ne rejoint pas les `ExistingCut` actifs.

La première version de l’atelier reste mono-auteur. Elle ne résout ni édition concurrente, ni conflit de validation, ni synchronisation temps réel.

## Contrats à exposer

P1.2 devra donner au web un contrat unique pour charger le contexte de travail d’une section : section, fragment, `bookParts`, `bookPlan`, décisions actives, historique utile et bibliothèque distribuée. Il devra aussi exposer des commandes distinctes pour lancer une lecture, valider, adapter et refuser une proposition. Les routes ne fabriqueront pas de décision à partir d’un simple verdict : elles appelleront le service métier de décision avec une intention auteur explicite.

P1.3 consommera ce contrat pour l’écran de lecture. P1.4 appliquera les trois actes auteur et rendra le nouvel état sans recharger une seconde source de vérité. P1.5 préparera le contexte de rédaction, sans déclencher de texte.

## Seams de test

| Ticket | Seam public | Exemple de comportement à verrouiller |
| --- | --- | --- |
| P1.2 | API de contexte et commandes éditoriales | Une section réelle expose ses coupes actives, son plan et ses sources sans livrer de corpus intégral. |
| P1.3 | Écran d’atelier | Un auteur voit le verdict et les impacts sans pouvoir déclencher une décision implicite. |
| P1.4 | Commandes auteur via API | Valider crée une décision active ; adapter sans note est refusé ; refuser ne crée pas de coupe active. |
| P1.5 | Préparation de rédaction | Seules les décisions actives et les sources qualifiées préparent l’`EvidencePack`. |

## Limites de P1

P1 ne traite ni orchestration de chapitre ou de livre, ni routage de juges spécialisés, ni recherche factuelle automatique, ni collaboration multi-auteurs. L’atelier n’évalue pas une qualité littéraire et n’exécute jamais un changement éditorial à la place de l’auteur.
