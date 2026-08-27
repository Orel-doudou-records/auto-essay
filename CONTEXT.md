# Contexte du projet

Glossaire du domaine d'Auto Essay. Il décrit le vocabulaire partagé, pas
l'implémentation.

## Vocabulaire

- **Fragment** : position en formation (intuition, note, idée) mise en regard
  de ses sources. Référencée par un énoncé (`statement`) et des `Claim`/`Source`
  existants — ce n'est pas un objet canonique autonome.
- **Lecture diffractive** (`DiffractiveReading`) : trace de raisonnement en
  quatre passes qui confronte un fragment au livre. Jamais exécutable.
- **Verdict** : décision forcée issue de la lecture diffractive. Cinq valeurs,
  sans « ça dépend » : `integrate_now`, `adapt_differently`, `incubate`,
  `archive`, `discard`.
- **Coupe agentielle** (`DiffractiveCut`) : ce qu'une décision rend
  intelligible ou invisible — l'inclusion, l'exclusion, et l'exclusion de la
  non-décision.
- **Articulation** (`ContentStyleArticulation`) : proposition située reliant
  une configuration de contenu à des opérations d'écriture.
- **Décision éditoriale** (`EditorialDecision`) : engagement validé par
  l'auteur, seule autorité exécutable issue d'une articulation.
- **Partie du livre en cours** (`BookPart`) : morceau nommé du livre (acte,
  chapitre, section) porté avec son statut de rédaction — y compris
  « planifiée », pas encore écrite. C'est l'unité de vue du lecteur diffractif
  sur le chantier.
- **Statut de rédaction** (`DraftUnitStatus`) : état d'une partie ou d'une
  unité — `drafting` (ébauche), `reviewing` (en révision), `revising`
  (en réécriture), `verified` (rédigé/validé), `published`, `archived`.
- **Coupe déjà édictée** (`ExistingCut`) : engagement de l'auteur déjà pris
  (scope + verdict + coupe) avec lequel le lecteur diffractif compose — il ne
  recommande pas de la réédicter, il ne la contredit pas en silence.
- **Atelier de décision auteur** : parcours mono-auteur qui rend une lecture
  diffractive située, puis recueille une validation, une adaptation ou un
  refus. Il conserve la proposition comme trace et ne rend exécutable qu'une
  décision explicitement validée.
- **Refus éditorial** : acte de l'auteur qui archive une proposition et sa
  lecture sans créer de décision active ni de coupe déjà édictée.
- **Source non qualifiée** : source visible dans une bibliothèque distribuée,
  mais dépourvue du profil ou de l'extrait nécessaire pour devenir une preuve
  automatique dans un `EvidencePack`.
- **Statut d'assemblage** : statut d'une position dans le livre (arbre),
  distinct du statut de rédaction de l'unité — une unité rédigée peut être
  montée dans un chapitre ébauche.
- **Contexte d’évaluation intégrée** : provenance canonique qui relie une
  version d’unité à une décision auteur active, à ses projections spécialisées
  et aux déclarations de transformation du Writer. Il permet un jugement
  éditorial, sans jamais devenir une décision éditoriale.
- **Préparabilité d’évaluation intégrée** : état de lecture d’une unité qui
  indique si son contexte canonique est complet et encore valide. Une unité
  non préparée ou devenue incohérente reste évaluable documentairement, mais ne
  peut pas recevoir un jugement éditorial intégré.

## Frontière

La lecture diffractive produit des **matières** (verdicts, coupes) ; elle ne
décide jamais à la place de l'auteur. Le verdict est une recommandation, la
décision éditoriale est l'engagement humain.

Le livre est lu comme un **chantier** : le lecteur connaît la structure, le
statut de chaque partie et les coupes déjà édictées. Une ébauche se retravaille,
un passage rédigé ne change que par une coupe nette.