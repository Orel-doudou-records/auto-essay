# Granularités de rédaction

Ce document explique les quatre niveaux de granularité supportés par le moteur, leurs objectifs de mots, leurs modes de prompt et leurs cas d'usage.

## Principe général

Le moteur est conçu pour être **testé à l'échelle du paragraphe, architecturé pour toutes les granularités**. Cela signifie que les mécanismes fondamentaux (evidence pack, évaluation, révision) fonctionnent à tous les niveaux, mais que seul le mode paragraphe est pleinement opérationnel en MVP.

## Tableau comparatif

| Granularité | Objectif mots | Objectif pédagogique | Usage typique |
|-------------|---------------|----------------------|---------------|
| **Paragraph** | 200 (±20 %) | Fragment argumentatif ciblé | Preuve isolée, transition, objection |
| **Section** | 1 200 (±20 %) | Sous-partie structurée avec 4 mouvements | Développement d'une thèse secondaire |
| **Chapter** | 5 000 (±20 %) | Chapitre avec carte argumentative complète | Chapitre d'ouvrage, article de revue |
| **Book** | 50 000+ | Architecture globale d'un essai | Monographie, thèse de doctorat |

## Mode PARAGRAPHE

### Prompt

```
Tu travailles en mode PARAGRAPHE.
Objectif : intégrer le fragment dans une section, sans sur-interpréter.
Contraintes :
- 180-220 mots
- 2 citations max, toutes de l'evidence pack
- distingue fait / interprétation / hypothèse
- assertion non prouvée → reformuler prudemment
```

### Sortie JSON

- `plan_3_sentences` : mouvement en 3 phrases
- `paragraph` : texte final
- `claims` : assertions extraites
- `confidence_assessment` : solidité globale

### Classe implémentée

`ParagraphGenerator` dans `src/pipeline/paragraphMode.ts`.

## Mode SECTION (planifié)

### Prompt prévu

```
Mode SECTION.
Construis une section de 1200-1500 mots.
Tu dois :
- proposer un sous-plan en 4 mouvements
- signaler 3 objections
- rédiger la section
- produire un claim ledger
- lister ce qui doit être vérifié
```

### Spécificités

- Le sous-plan structure la section en 4 parties logiques.
- Les objections sont signalées explicitement, pas seulement traitées en passant.
- Le claim ledger est une liste exhaustive des assertions de la section.

## Mode CHAPITRE (planifié)

### Prompt prévu

```
Mode CHAPITRE.
Crée :
- carte argumentative détaillée
- transitions principales
- passages nécessitant source primaire
- brief de révision
Ne rédige pas si sources insuffisantes.
```

### Spécificités

- Le chapitre n'est pas rédigé d'un bloc. Le générateur produit d'abord une architecture, puis délègue la rédaction aux modes section/paragraphe.
- Le brief de révision est généré avant la rédaction pour anticiper les problèmes.

## Mode LIVRE (planifié)

### Prompt prévu

```
Mode LIVRE.
Construis l'architecture d'un essai complet :
- question centrale, thèse
- 8-10 chapitres avec promesses
- preuves majeures, objections
- dettes documentaires
- ordre des phases de rédaction
```

### Spécificités

- Ne produit pas de texte continu, mais un plan détaillé et des briefs pour chaque chapitre.
- Identifie les dettes documentaires : les sources qui doivent être trouvées avant de commencer la rédaction.
- Définit l'ordre optimal de rédaction (certains chapitres doivent être écrits avant d'autres pour maintenir la cohérence).

## Décomposition d'une granularité supérieure

Un mode chapitre ne remplace pas les modes inférieurs. Il les orchestre :

```
Mode LIVRE
    ↓
Architecture globale + dettes
    ↓
Mode CHAPITRE (par chapitre)
    ↓
Carte argumentative + briefs
    ↓
Mode SECTION (par section)
    ↓
Sous-plan + objections
    ↓
Mode PARAGRAPHE (par paragraphe)
    ↓
Texte final + claims
```

Cette décomposition garantit que chaque fragment est évalué à l'échelle la plus fine possible, tout en conservant une vision d'ensemble.

## Anti-patterns

- **Générer un chapitre comme un long paragraphe** : perd la structure interne, les transitions entre sous-parties et le contrôle des objections.
- **Sauter le mode section pour aller directement au paragraphe** : risque de dérives thématiques et de redites.
- **Ignorer les dettes documentaires en mode livre** : produit un plan irréalisable faute de sources.

## Voir aussi

- [Comment générer des paragraphes](../how-to/generer-paragraphes.md)
- [Comment configurer un projet](../how-to/configurer-projet.md)
- [Référence : API](../reference/api.md)
