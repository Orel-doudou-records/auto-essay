/**
 * parseJsonRobustly — parse une sortie de LLM censée être du JSON, en tolérant
 * les défauts les plus fréquents rencontrés avec les grands modèles :
 *   - balises de code markdown (```json … ```)
 *   - texte parasite avant/après le JSON
 *   - virgules de fin de liste / d'objet
 *   - JSON tronqué (chaîne ou structure non refermée)
 *
 * Fonction pure : aucune I/O, déterministe, testable sans modèle.
 */

function stripFences(text: string): string {
  return text.replace(/```[a-zA-Z]*\s*/g, "").replace(/```/g, "");
}

function minIndex(a: number, b: number): number {
  if (a === -1) return b;
  if (b === -1) return a;
  return Math.min(a, b);
}

function extractJsonSpan(text: string): string {
  const first = minIndex(text.indexOf("{"), text.indexOf("["));
  if (first === -1) throw new Error("Aucun délimiteur JSON trouvé");
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = first; i < text.length; i++) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0) return text.slice(first, i + 1);
    }
  }
  // Structure non refermée : on renvoie le reste (réparé par closeTruncated).
  return text.slice(first);
}

function removeTrailingCommas(json: string): string {
  return json.replace(/,(\s*[}\]])/g, "$1");
}

function closeTruncated(json: string): string {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (const ch of json) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") {
      if (stack.length > 0) stack.pop();
    }
  }
  let result = json;
  if (inString) result += '"';
  while (stack.length > 0) result += stack.pop();
  return result;
}

export function parseJsonRobustly(text: string): unknown {
  const cleaned = stripFences(text);
  const span = extractJsonSpan(cleaned);
  const candidates = [
    span,
    removeTrailingCommas(span),
    closeTruncated(span),
    closeTruncated(removeTrailingCommas(span)),
  ];
  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (err) {
      lastError = err;
    }
  }
  const message =
    lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`JSON invalide : ${message}`);
}
