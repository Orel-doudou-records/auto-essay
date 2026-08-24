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

## Frontière

La lecture diffractive produit des **matières** (verdicts, coupes) ; elle ne
décide jamais à la place de l'auteur. Le verdict est une recommandation, la
décision éditoriale est l'engagement humain.

Le livre est lu comme un **chantier** : le lecteur connaît la structure, le
statut de chaque partie et les coupes déjà édictées. Une ébauche se retravaille,
un passage rédigé ne change que par une coupe nette.