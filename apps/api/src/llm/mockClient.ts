import type { ModelClient } from "./client.js";

const MOCK_PARAGRAPH_JSON = JSON.stringify({
  plan_3_sentences: [
    "Première phrase du plan simulé.",
    "Deuxième phrase du plan simulé.",
    "Troisième phrase du plan simulé.",
  ],
  paragraph:
    "Ceci est un paragraphe simulé généré par le client mock. Il contient suffisamment de mots pour respecter l'objectif de longueur demandé par le générateur de paragraphe. Le contenu est purement factice et sert à valider le pipeline de génération sans appeler de modèle de langage externe.",
  claims: [
    {
      statement: "Assertion simulée.",
      confidenceLevel: "speculative",
      sourceIds: [],
    },
  ],
  confidence_assessment: "medium",
  applied_directives: [],
});

const MOCK_EVALUATION_JSON = JSON.stringify({
  overallScore: 6.5,
  dimensions: {
    claimSupport: 6,
    citationIntegrity: 7,
    counterargumentQuality: 6,
    transitionClarity: 7,
    scopeControl: 6,
    voiceConsistency: 7,
  },
  weaknesses: [],
  strongClaims: ["Assertion simulée."],
  weakClaims: [],
  aiPatternsDetected: [],
  overclaimRisks: [],
  top3Revisions: [
    {
      priority: 1,
      target: "Renforcer les preuves",
      issue: "Les preuves restent générales.",
      approach: "Ajouter des citations précises.",
    },
  ],
  newClaimEntries: [],
  evidenceGaps: [],
  citationGaps: [],
  verdict: "keep_with_minor_edits",
});

export class MockClient implements ModelClient {
  async complete(system: string, user: string): Promise<string> {
    if (user.includes("évaluateur critique")) {
      return MOCK_EVALUATION_JSON;
    }
    if (system.includes("JSON")) {
      return MOCK_PARAGRAPH_JSON;
    }
    return `Réponse simulée. Système: ${system.slice(0, 40)}… Utilisateur: ${user.slice(0, 40)}…`;
  }

  async completeStream(
    _system: string,
    _user: string,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const chunks = ["Réponse ", "simulée ", "en ", "streaming."];
    for (const chunk of chunks) {
      onChunk(chunk);
    }
  }
}
