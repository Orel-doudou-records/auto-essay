/**
 * Vérifications mécaniques (sans LLM)
 * Inspiré d'autonovel : deux "immune systems"
 * 1. Mécanique (ce fichier) - tics de langage, patterns
 * 2. LLM (evaluateEssay.ts) - évaluation argumentative
 */

import { STRONG_ASSERTION_WORDS, PRUDENT_WORDS } from "../domain/claim";

/**
 * Issue détectée par vérification mécanique
 */
export interface MechanicalIssue {
  type:
    | "strong_assertion"
    | "missing_citation"
    | "filler_phrase"
    | "transition_overuse"
    | "citation_format"
    | "unclear_boundary";
  message: string;
  location: string; // Contexte/extrait
  severity: "error" | "warning" | "info";
  suggestion?: string;
}

/**
 * Phrases de remplissage à détecter
 */
export const FILLER_PHRASES = [
  /il est important de noter que/gi,
  /il convient de souligner que/gi,
  /force est de constater que/gi,
  /comme nous l'avons vu/gi,
  /comme mentionné précédemment/gi,
  /ce qui nous amène à/gi,
  /partant de ce constat/gi,
  /de ce fait/gi,
  /ainsi donc/gi,
  /en d'autres termes/gi,
  /pour faire simple/gi,
  /en résumé/gi,
];

/**
 * Transitions à ne pas surutiliser
 */
export const OVERUSED_TRANSITIONS = [
  "cependant",
  "toutefois",
  "néanmoins",
  "par ailleurs",
  "de plus",
  "en outre",
  "ainsi",
  "par conséquent",
  "en effet",
];

/**
 * Patterns de citation
 */
export const CITATION_PATTERNS = {
  // (Auteur, 2023)
  authorDate: /\([A-Z][a-z]+(?:\s+et\s+al\.?)?,\s*\d{4}[a-z]?\)/g,
  // (Auteur 2023)
  authorDateNoComma: /\([A-Z][a-z]+\s+\d{4}[a-z]?\)/g,
  // [1], [2-3]
  numeric: /\[\d+(?:-\d+)?\]/g,
  // (1), (2)
  parenNumeric: /\(\d+(?:,\s*\d+)*\)/g,
};

/**
 * Détecte les assertions fortes sans preuve (anti-overclaim)
 */
export function detectStrongAssertions(text: string): MechanicalIssue[] {
  const issues: MechanicalIssue[] = [];

  for (const word of STRONG_ASSERTION_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Verifier s'il y a une citation proche (50 caracteres apres)
      const after = text.slice(match.index, match.index + 100);
      const hasCitation = Object.values(CITATION_PATTERNS).some((pattern) =>
        pattern.test(after)
      );

      if (!hasCitation) {
        issues.push({
          type: "strong_assertion",
          message: `Assertion forte "${word}" sans citation immediate`,
          location: text.slice(
            Math.max(0, match.index - 30),
            Math.min(text.length, match.index + 50)
          ),
          severity: "warning",
          suggestion: `Ajouter une citation ou remplacer par un terme plus prudent (${PRUDENT_WORDS.slice(0, 3).join(", ")})`,
        });
      }
    }
  }

  return issues;
}

/**
 * Detecte les citations manquantes pour les faits/affirmations
 */
export function detectMissingCitations(text: string): MechanicalIssue[] {
  const issues: MechanicalIssue[] = [];
  const reportedRanges: Array<{ start: number; end: number }> = [];

  // Patterns qui indiquent un fait/affirmation
  const factPatterns = [
    /\d{4}/g, // Annees (hors citations)
    /selon\s+les\s+\w+/gi, // "selon les..."
    /les\s+etudes\s+montrent/gi,
    /la\s+recherche\s+a\s+\w+/gi,
    /\d+%/g, // Pourcentages
    /en\s+\d{4}/g, // "en 2023"
  ];

  for (const pattern of factPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const matchStart = match.index;
      const matchEnd = match.index + match[0].length;

      // Verifier s'il y a une citation dans les 80 caracteres avant/apres
      const before = text.slice(Math.max(0, matchStart - 80), matchStart);
      const after = text.slice(
        matchEnd,
        Math.min(text.length, matchEnd + 80)
      );

      const context = before + after;
      const hasCitation = Object.values(CITATION_PATTERNS).some((p) =>
        p.test(context)
      );

      if (!hasCitation) {
        // Verifier si c'est pas deja reporte dans un rayon de 50 caracteres
        const alreadyReported = reportedRanges.some(
          (range) => Math.abs(range.start - matchStart) < 50
        );

        if (!alreadyReported) {
          const location = text.slice(
            Math.max(0, matchStart - 30),
            Math.min(text.length, matchEnd + 30)
          );

          issues.push({
            type: "missing_citation",
            message: `Fait potentiel sans citation`,
            location,
            severity: "info",
            suggestion: "Verifier si cette information necessite une source",
          });
          reportedRanges.push({ start: matchStart, end: matchEnd });
        }
      }
    }
  }

  return issues;
}

/**
 * Detecte les phrases de remplissage
 */
export function detectFillerPhrases(text: string): MechanicalIssue[] {
  const issues: MechanicalIssue[] = [];

  for (const pattern of FILLER_PHRASES) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      issues.push({
        type: "filler_phrase",
        message: `Phrase de remplissage detectee`,
        location: match[0],
        severity: "info",
        suggestion: "Supprimer ou remplacer par une formulation plus directe",
      });
    }
  }

  return issues;
}

/**
 * Detecte la surutilisation de transitions
 */
export function detectTransitionOveruse(text: string): MechanicalIssue[] {
  const issues: MechanicalIssue[] = [];
  const transitionCounts: Record<string, number> = {};

  // Compter les occurrences
  for (const transition of OVERUSED_TRANSITIONS) {
    const regex = new RegExp(`\\b${transition}\\b`, "gi");
    const matches = text.match(regex);
    if (matches) {
      transitionCounts[transition] = matches.length;
    }
  }

  // Word count pour calculer la densite
  const wordCount = text.split(/\s+/).length;

  // Detecter les surutilisations (>1% du texte = trop)
  for (const [transition, count] of Object.entries(transitionCounts)) {
    const density = count / wordCount;
    if (density > 0.01) {
      issues.push({
        type: "transition_overuse",
        message: `Transition "${transition}" surutilisee (${count} fois)`,
        location: transition,
        severity: "warning",
        suggestion: `Varier les transitions ou supprimer certaines occurrences`,
      });
    }
  }

  return issues;
}

/**
 * Verifie le format des citations
 */
export function checkCitationFormat(text: string): MechanicalIssue[] {
  const issues: MechanicalIssue[] = [];

  // Detecter les citations mal formatees
  const malformedPatterns = [
    // Parentheses mal fermees
    /\([A-Z][a-z]+\s+\d{4}[^)]*$/gm,
    // Annees isolees sans auteur
    /\(\d{4}[a-z]?\)/g,
    // "p." sans numero
    /\(\s*p\.?\s*\)/gi,
  ];

  for (const pattern of malformedPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      issues.push({
        type: "citation_format",
        message: `Format de citation potentiellement incorrect`,
        location: match[0],
        severity: "warning",
        suggestion: "Verifier le format (Auteur, 2023) ou (Auteur 2023, p. 12)",
      });
    }
  }

  return issues;
}

/**
 * Detecte les frontieres floues entre fait et interpretation
 */
export function detectUnclearBoundaries(text: string): MechanicalIssue[] {
  const issues: MechanicalIssue[] = [];

  // Patterns qui melangent fait et interpretation
  const boundaryPatterns = [
    // "ce qui prouve que" sans nuance
    /ce\s+qui\s+(?:prouve|demontre|confirme)\s+que/gi,
    // "cela signifie que" sans modalisation
    /cela\s+signifie\s+que/gi,
    // "il est evident que"
    /il\s+est\s+(?:evident|clair|manifeste)\s+que/gi,
  ];

  for (const pattern of boundaryPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      issues.push({
        type: "unclear_boundary",
        message: `Frontiere fait/interpretation floue`,
        location: text.slice(
          Math.max(0, match.index - 20),
          Math.min(text.length, match.index + 50)
        ),
        severity: "warning",
        suggestion: "Modaliser (suggere, indique, pourrait signifier) ou citer une source",
      });
    }
  }

  return issues;
}

/**
 * Execute toutes les verifications mecaniques
 */
export function runMechanicalChecks(text: string): MechanicalIssue[] {
  const allIssues: MechanicalIssue[] = [
    ...detectStrongAssertions(text),
    ...detectMissingCitations(text),
    ...detectFillerPhrases(text),
    ...detectTransitionOveruse(text),
    ...checkCitationFormat(text),
    ...detectUnclearBoundaries(text),
  ];

  // Trier par severite
  const severityOrder = { error: 0, warning: 1, info: 2 };
  return allIssues.sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  );
}

/**
 * Verifie si le texte passe les controles mecaniques
 */
export function passesMechanicalChecks(
  text: string,
  maxErrors: number = 0,
  maxWarnings: number = 5
): { passed: boolean; issues: MechanicalIssue[] } {
  const issues = runMechanicalChecks(text);
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;

  return {
    passed: errors <= maxErrors && warnings <= maxWarnings,
    issues,
  };
}
