export function normalizeDomain(input: string): string {
  let d = input.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "");
  d = d.replace(/^www\./, "");
  d = d.replace(/\/+$/, "");
  return d;
}

export function toAbsoluteUrl(baseUrl: string, href: string): string | null {
  const trimmed = href.trim();
  if (
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:") ||
    trimmed.startsWith("data:") ||
    trimmed.length === 0
  ) {
    return null;
  }
  try {
    return new URL(trimmed, baseUrl).href;
  } catch {
    return null;
  }
}

export function guessPressPaths(): string[] {
  return [
    "/press",
    "/media",
    "/newsroom",
    "/press-room",
    "/pressroom",
    "/media-resources",
    "/press-kit",
    "/presskit",
    "/news",
    "/about/press",
    "/about/media",
    // Korean entertainment press paths
    "/en/newsroom",          // SM Entertainment
    "/eng/news/news",        // HYBE
    "/en/news",              // CJ ENM
    "/c/3/11",               // FNC Entertainment PR Center
  ];
}
