# UI1 — StyleX et écran d’écriture sans distraction

## Problem Statement

Auto Essay possède des parcours éditoriaux fonctionnels, mais son frontend de démonstration est encore assemblé autour de classes utilitaires et de primitives génériques. L’écran d’écriture fait coexister en permanence la liste des unités, l’éditeur et le chat de révision ; cette disposition concurrence le manuscrit au lieu de le servir. La direction souhaitée impose une application d’écriture épurée, utilisable longtemps, avec un mode sombre cohérent et une surface de texte prioritaire.

Le projet doit remplacer immédiatement Tailwind, ses utilitaires de fusion de classes et ses primitives dépendantes par StyleX. Ce remplacement est acceptable parce que l’interface n’a pas encore fait l’objet d’une finition produit. Il doit préserver les parcours métier validés : l’auteur demeure l’autorité des décisions et une assistance ne modifie jamais le manuscrit sans un geste explicite.

## Solution

L’application adopte StyleX comme système unique de styles. Des tokens sémantiques décrivent les surfaces, textes, bordures, états, espacements, rayons et typographies des thèmes clair et sombre. La configuration Vite emploie l’intégration officielle `@stylexjs/unplugin`, placée avant le plugin React, et conserve une feuille CSS globale limitée au reset et à l’émission du CSS agrégé.[1]

Le premier écran redessiné est l’éditeur. Il propose une navigation de manuscrit escamotable, un canevas de texte au centre et un inspecteur unique ouvert seulement à la demande. Le manuscrit utilise une sérif de lecture avec une largeur et un interligne constants ; l’interface emploie une sans-sérif discrète. L’ensemble utilise des surfaces neutres, un accent bleu-gris et des couleurs réservées aux statuts. Le thème suit la préférence du système au premier accès, puis respecte un choix explicite mémorisé.

Les autres écrans passent aux primitives StyleX du nouveau socle, puis reçoivent leur adaptation visuelle par séquences distinctes. La révision assistée reste hors de la migration visuelle : elle deviendra ensuite une proposition éditable, comparée à sa version de départ et appliquée seulement après validation explicite de l’auteur.

## User Stories

1. En tant qu’auteur, je veux choisir un thème clair ou sombre qui reste mémorisé, afin d’écrire dans un environnement adapté à ma préférence.
2. En tant qu’auteur, je veux que le thème initial suive mon système, afin de ne pas devoir régler l’interface avant d’écrire.
3. En tant qu’auteur, je veux voir le manuscrit dans une colonne lisible, avec une typographie de lecture et un interligne généreux, afin de rester concentré sur le texte.
4. En tant qu’auteur, je veux masquer la navigation du manuscrit, afin de libérer l’espace pendant une séance d’écriture.
5. En tant qu’auteur, je veux retrouver rapidement la liste des unités depuis la navigation, afin de changer de section sans quitter l’éditeur.
6. En tant qu’auteur, je veux voir le titre de l’unité au-dessus du texte, afin de conserver mon repère narratif sans afficher les paramètres secondaires.
7. En tant qu’auteur, je veux un état de sauvegarde discret, afin de savoir si mon texte est en cours d’enregistrement ou durablement conservé sans subir de bouton envahissant.
8. En tant qu’auteur, je veux créer une unité ou en choisir une depuis un état vide calme, afin de commencer sans écran de pilotage chargé.
9. En tant qu’auteur, je veux ouvrir un seul inspecteur pour accéder aux outils de révision, d’évaluation et de diffraction, afin que ces fonctions ne concurrencent pas le manuscrit en permanence.
10. En tant qu’auteur, je veux utiliser les mêmes contrôles, couleurs d’état et espacements sur tous les écrans, afin que les parcours éditoriaux restent reconnaissables.
11. En tant qu’auteur sur tablette ou mobile, je veux accéder au manuscrit, à la navigation et aux outils dans des tiroirs ou panneaux adaptés, afin que les fonctions essentielles restent disponibles hors bureau.
12. En tant qu’auteur, je veux que les parcours de décision, de diffraction et de révision existants conservent leurs garanties d’autorité, afin qu’une refonte visuelle ne change pas le comportement éditorial.
13. En tant que futur auteur, je veux recevoir une proposition de révision séparée du manuscrit, pouvoir l’ajuster et l’appliquer explicitement, afin de conserver le dernier mot sur mon texte.
14. En tant qu’auteur, je veux qu’une proposition de révision soit signalée comme périmée lorsque le manuscrit a évolué, afin qu’elle ne puisse pas écraser une version plus récente.

## Implementation Decisions

- StyleX devient le seul système de styles du frontend. Tailwind, ses plugins, les outils de fusion de classes et les primitives qui en dépendent sont retirés après migration complète des appels.
- Le socle comprend les tokens sémantiques de thème, une préférence persistante, les primitives de contrôle et de surface, le shell de l’application et les règles de responsive communes.
- Les thèmes sont clair et sombre. La palette associe des neutres de type papier et charbon à un accent bleu-gris ; les couleurs de succès, attention et erreur signalent seulement un état métier.
- La préférence de thème suit le système en l’absence de choix local. Un geste explicite de l’auteur remplace ensuite cette valeur et reste mémorisé.
- La navigation de manuscrit est escamotable. Le bureau privilégie un canevas central et l’inspecteur devient un panneau latéral ouvert à la demande ; sur petite largeur, navigation et inspecteur deviennent des tiroirs indépendants.
- L’éditeur reste un champ de texte simple. Aucun éditeur riche, barre de formatage ou changement de format de manuscrit n’est inclus dans UI1.
- La sauvegarde devient automatique après une courte temporisation. L’état visible distingue la modification locale, l’enregistrement en cours, l’enregistrement réussi et l’échec ; il ne change pas les règles de versionnement du domaine.
- Le titre de l’unité apparaît dans la zone de rédaction. Le statut, l’objectif de longueur et les outils d’assistance vivent dans l’inspecteur.
- L’inspecteur unifie les outils d’assistance déjà existants sans modifier leur autorité ni leur contrat pendant la migration de styles.
- La proposition de révision éditable, sa comparaison et la protection contre la péremption sont une livraison fonctionnelle ultérieure. Cette livraison aura son propre état persistant, ses contrats API et ses tests de comportement.
- Les nouveaux tests utilisent les seams confirmés : l’écran d’écriture et le shell partagé. Ils n’observent jamais les objets StyleX ni le CSS compilé.

## Testing Decisions

Les tests doivent décrire des comportements visibles pour l’auteur : changement de thème, mémorisation de préférence, ouverture de navigation, ouverture de l’inspecteur, état vide, titre du manuscrit et signal de sauvegarde. Ils ne dépendent ni d’une classe CSS, ni du nom d’un token, ni de la structure des objets de styles.

Le seam de l’écran d’écriture couvre le canevas prioritaire, les panneaux escamotables et les états de persistance. Le seam du shell partagé couvre l’initialisation de thème, son changement explicite et la continuité des contrôles communs entre les routes. Les tests d’interface existants des parcours d’édition, de décision et de diffraction servent de garde-fou contre une régression métier. La construction Vite et le typage complètent ces preuves en validant l’intégration compilée de StyleX.

## Out of Scope

UI1 n’ajoute ni éditeur riche, ni format Markdown visible, ni collaboration temps réel, ni application mobile native, ni notifications externes. Il ne modifie pas le modèle métier de diffraction, la gouvernance auteur, les décisions éditoriales ou les évaluations intégrées. La comparaison de révision et la mise à jour du manuscrit à partir d’une proposition d’assistance ne font pas partie de la migration StyleX.

## Further Notes

La migration complète de Tailwind est un refactor transverse. Elle suit une livraison du socle et de l’écran pilote, puis une adaptation des autres routes aux primitives partagées avant suppression des dépendances antérieures. Les tickets maintiennent la CI verte à chaque étape ; la suppression définitive ne s’effectue que lorsqu’aucun écran ne dépend plus de Tailwind.

## References

[1] [StyleX — Vite + React](https://stylexjs.com/docs/learn/installation/vite/vite-react) : le guide officiel décrit l’intégration `@stylexjs/unplugin`, son ordre avant le plugin React et l’agrégation du CSS dans l’asset Vite.
