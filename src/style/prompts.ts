import type {
  DiffractiveStylePlan,
  StyleProfile,
} from "../domain/styleProfile";

export interface StyleAnalysisRequest {
  sourceText: string;
  sourceLabel?: string;
  authorIntent?: string;
  audience?: string;
  constraints?: string[];
}

export interface DiffractiveStyleRequest {
  profile: StyleProfile;
  subject: string;
  thesis?: string;
  genre?: string;
  audience?: string;
  constraints?: string[];
}

/**
 * Analyse holistique Literacraft.
 * Le modèle doit produire des mécanismes observables, étayés par des indices,
 * plutôt qu'une collection d'adjectifs stylistiques.
 */
export function buildStyleAnalysisPrompt(request: StyleAnalysisRequest): string {
  return `Tu es Literacraft, un analyste littéraire holistique.

Ta mission est d'analyser le texte source pour produire un profil stylistique structuré et réutilisable. Tu ne dois pas résumer le contenu. Tu dois identifier des mécanismes formels, leurs effets, leur intensité et leur degré d'adaptabilité.

## Texte source
\`\`\`
${request.sourceText}
\`\`\`

${request.sourceLabel ? `## Libellé de la source\n${request.sourceLabel}\n` : ""}
${request.authorIntent ? `## Intention déclarée\n${request.authorIntent}\n` : ""}
${request.audience ? `## Public visé\n${request.audience}\n` : ""}
${request.constraints?.length ? `## Contraintes explicites\n${request.constraints.map((item) => `- ${item}`).join("\n")}\n` : ""}

## Axes d'analyse intégrés

1. Narration et structure : voix, distance, focalisation, progression, digressions, transitions, temporalité, paradoxes.
2. Syntaxe, rythme et musicalité : longueur des phrases, cadence, ponctuation, accélérations, suspensions, échos sonores.
3. Tonalité et lexique : registres, champs lexicaux, connotations, progression émotionnelle, distance au lecteur.
4. Rhétorique, genre et symbolisme : métaphores, figures, réseaux symboliques, conventions, hybridations, détournements.
5. Imperfection créative : ruptures productives, hésitations, contradictions, fragments, irrégularités qui donnent du souffle.
6. Piliers de contenu : thèmes centraux, sous-thèmes, contrepoints, symboles et relations.
7. Intention : effet recherché, pacte de lecture, public, contraintes et frontières de la voix.

## Règles

- Chaque pattern doit décrire un mécanisme, pas seulement une qualité.
- Chaque pattern doit comporter au moins un indice textuel bref.
- Distingue les invariants de voix, les variables contextuelles et les éléments inséparables de la source.
- Signale les risques d'imitation de surface.
- Préserve les mécanismes, jamais les formulations exactes.
- Ne cite aucun auteur comme raccourci descriptif.

## Format JSON strict

{
  "authorIntent": {
    "primaryAim": "string",
    "desiredReaderEffect": ["string"],
    "targetAudience": "string optionnel",
    "explicitConstraints": ["string"]
  },
  "summary": "string",
  "patterns": [
    {
      "id": "pattern-kebab-case",
      "dimension": "narration|structure|syntax|rhythm|tone|lexicon|rhetoric|symbolism|readerRelation|creativeImperfection",
      "mechanism": "string",
      "effect": "string",
      "evidence": ["court indice textuel"],
      "strength": "trace|secondary|strong|dominant",
      "adaptability": "invariant|contextual|transformable|sourceBound",
      "imitationRisk": "low|medium|high"
    }
  ],
  "contentPillars": [
    {
      "name": "string",
      "description": "string",
      "role": "central|supporting|counterpoint|latent",
      "symbols": ["string"]
    }
  ],
  "signature": {
    "invariants": ["string"],
    "variables": ["string"],
    "productiveTensions": ["string"],
    "antiPatterns": ["string"]
  },
  "ethicalBoundary": {
    "preserveMechanismsNotSurface": true,
    "forbiddenVerbatimReuse": true,
    "notes": ["string"]
  }
}`;
}

/**
 * Lecture diffractive du profil stylistique et du contexte cible.
 * Les deux ne préexistent pas comme objets fixes : la sortie doit expliciter
 * ce que leur relation rend visible et les coupes qu'elle produit.
 */
export function buildDiffractiveStylePrompt(
  request: DiffractiveStyleRequest
): string {
  const profileJson = JSON.stringify(request.profile, null, 2);

  return `Tu réalises une lecture diffractive au sens de Donna Haraway et Karen Barad.

Tu ne compares pas un style source à un sujet cible. Tu les lis l'un à travers l'autre pour faire apparaître des différences productives, des contraintes cachées et une voix émergente. L'objectif n'est jamais l'imitation. L'objectif est une transformation située et responsable.

## Profil stylistique Literacraft
\`\`\`json
${profileJson}
\`\`\`

## Contexte cible
- Sujet : ${request.subject}
- Thèse : ${request.thesis || "non spécifiée"}
- Genre : ${request.genre || "essai"}
- Public : ${request.audience || "non spécifié"}
- Contraintes : ${(request.constraints || []).join(" ; ") || "aucune"}

## Passe 1 — Lire la source à travers la cible

Décris ce que les patterns du profil deviennent lorsqu'ils rencontrent ce sujet, cette thèse, ce genre et ces contraintes. Identifie les patterns qui changent de fonction, deviennent problématiques ou révèlent une hypothèse cachée.

## Passe 2 — Lire la cible à travers la source

Décris ce que le profil rend visible dans le sujet cible : ses angles morts, ses automatismes argumentatifs, ses possibilités de rythme, de voix et de symbolisation. N'accorde aucune autorité automatique au profil.

## Passe 3 — Entanglements

Identifie les relations déjà actives entre patterns stylistiques et contraintes essayistiques : preuve, citation, public, genre, position du narrateur, densité, temporalité, symboles, risques de simplification.

Pour chaque relation, précise ce qu'une décision stylistique rend intelligible et ce qu'elle risque de marginaliser.

## Passe 4 — Coupes agentielles

Rends chaque décision explicite :
- ce qui est préservé ;
- ce qui est transformé ;
- ce qui est exclu ;
- qui ou quoi cette décision inclut ;
- qui ou quoi elle marginalise ;
- ce que produit aussi la non-adoption du pattern.

## Discipline

- Aucun transfert de formulation exacte.
- Aucun "écris comme".
- Aucun auteur utilisé comme preset.
- Les tensions peuvent rester non résolues si elles sont productives.
- Une voix émergente doit être décrite positivement, pas comme une copie dégradée.
- Les critères d'évaluation doivent totaliser un poids de 1.

## Format JSON strict

{
  "profileId": "${request.profile.id}",
  "target": {
    "subject": "${escapeJson(request.subject)}",
    "thesis": "${escapeJson(request.thesis || "")}",
    "genre": "${escapeJson(request.genre || "essai")}",
    "audience": "${escapeJson(request.audience || "")}",
    "constraints": ${JSON.stringify(request.constraints || [])}
  },
  "sourceThroughTarget": ["string"],
  "targetThroughSource": ["string"],
  "entanglements": [
    {
      "name": "string",
      "sourcePatternIds": ["string"],
      "targetConstraint": "string",
      "relation": "string",
      "whatBecomesVisible": ["string"],
      "whatRisksDisappearing": ["string"]
    }
  ],
  "cuts": [
    {
      "id": "cut-kebab-case",
      "entanglement": "string",
      "preserve": ["string"],
      "transform": ["string"],
      "exclude": ["string"],
      "inclusionEffects": ["string"],
      "exclusionEffects": ["string"],
      "rationale": "string"
    }
  ],
  "emergentVoice": {
    "description": "string",
    "generationDirectives": ["string"],
    "prohibitedShortcuts": ["string"]
  },
  "evaluationCriteria": [
    {
      "name": "string",
      "description": "string",
      "weight": 0.0
    }
  ]
}`;
}

export function buildGenerationStyleDirectives(
  profile: StyleProfile,
  plan: DiffractiveStylePlan
): string {
  const patternMap = new Map(
    profile.patterns.map((pattern) => [pattern.id, pattern])
  );

  const enactedPatterns = plan.cuts.flatMap((cut) =>
    cut.preserve
      .concat(cut.transform)
      .map((id) => patternMap.get(id))
      .filter((pattern): pattern is NonNullable<typeof pattern> => Boolean(pattern))
  );

  const patternLines = enactedPatterns.length
    ? enactedPatterns.map(
        (pattern) =>
          `- ${pattern.mechanism} → effet recherché : ${pattern.effect}`
      )
    : profile.signature.invariants.map((item) => `- ${item}`);

  return `## Direction stylistique diffractive

### Voix émergente
${plan.emergentVoice.description}

### Directives de génération
${plan.emergentVoice.generationDirectives.map((item) => `- ${item}`).join("\n")}

### Patterns à enactiver
${patternLines.join("\n") || "- Aucun pattern imposé"}

### Raccourcis interdits
${plan.emergentVoice.prohibitedShortcuts.map((item) => `- ${item}`).join("\n") || "- Ne pas imiter la surface du texte source"}

### Frontière éthique
Préserver les mécanismes de composition sans reprendre les formulations, les images singulières ou les marqueurs de surface de la source.`;
}

function escapeJson(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\r");
}
