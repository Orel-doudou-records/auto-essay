export function decodeEntities(value: string): string {
  return value.replace(/&(nbsp|amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi, (entity) => {
    const lower = entity.toLowerCase();
    const named: Record<string, string> = {
      "&nbsp;": " ",
      "&amp;": "&",
      "&lt;": "<",
      "&gt;": ">",
      "&quot;": '"',
      "&apos;": "'",
    };
    if (named[lower]) return named[lower];
    const numeric = lower.startsWith("&#x")
      ? Number.parseInt(lower.slice(3, -1), 16)
      : Number.parseInt(lower.slice(2, -1), 10);
    return Number.isInteger(numeric) && numeric >= 0 && numeric <= 0x10ffff ? String.fromCodePoint(numeric) : entity;
  });
}

export function readAttribute(attributes: string, name: string): string | undefined {
  const match = attributes.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  const value = match?.[1] ?? match?.[2] ?? match?.[3];
  return value ? decodeEntities(value) : undefined;
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function titleFromName(name: string): string {
  const basename = name.replace(/^.*[\\/]/, "").replace(/\.[^.]+$/, "").trim();
  return basename || "Manuscrit importé";
}
