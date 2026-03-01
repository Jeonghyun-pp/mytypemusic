// ============================================================================
// Wikipedia REST API client (Korean + English fallback)
//
// Used by the evergreen content pipeline to fetch encyclopedic facts
// for non-news topics (artist bios, album histories, etc.).
// ============================================================================

export interface WikiSection {
  title: string;
  content: string;
}

export interface WikiArticle {
  title: string;
  extract: string;       // Full plaintext extract
  url: string;           // Wikipedia page URL
  thumbnail?: string;    // Thumbnail image URL
  sections: WikiSection[];
}

export interface WikiSearchResult {
  title: string;
  snippet: string;       // HTML-stripped search snippet
  url: string;
}

// ============================================================================
// Helpers
// ============================================================================

function wikiApiUrl(lang: string): string {
  return `https://${lang}.wikipedia.org/w/api.php`;
}

function wikiPageUrl(lang: string, title: string): string {
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .trim();
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": "WebMagazineBot/1.0 (topic-intelligence)" },
  });
  if (!res.ok) {
    throw new Error(`Wikipedia API error: ${String(res.status)} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ============================================================================
// Search Wikipedia
// ============================================================================

/**
 * Search Wikipedia for pages matching a query.
 *
 * @param query  Search query
 * @param limit  Max results (default 5)
 * @param lang   Language code (default "ko")
 */
export async function searchWikipedia(
  query: string,
  limit = 5,
  lang = "ko",
): Promise<WikiSearchResult[]> {
  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: query,
    srlimit: String(limit),
    format: "json",
    origin: "*",
  });

  const url = `${wikiApiUrl(lang)}?${params.toString()}`;

  interface SearchResponse {
    query?: {
      search?: Array<{
        title: string;
        snippet: string;
      }>;
    };
  }

  const data = await fetchJson<SearchResponse>(url);
  const results = data.query?.search ?? [];

  return results.map((r) => ({
    title: r.title,
    snippet: stripHtml(r.snippet),
    url: wikiPageUrl(lang, r.title),
  }));
}

// ============================================================================
// Fetch Wikipedia article
// ============================================================================

/**
 * Fetch a Wikipedia article by searching for the query, then loading the
 * top result's full content.
 *
 * Falls back to English Wikipedia if the primary language yields no results.
 *
 * @param query  Search query (e.g. "커트 코베인")
 * @param lang   Language code (default "ko")
 */
export async function fetchWikipediaArticle(
  query: string,
  lang = "ko",
): Promise<WikiArticle | null> {
  // 1. Search for the page
  const searchResults = await searchWikipedia(query, 1, lang);

  if (searchResults.length === 0) {
    // Fallback to English
    if (lang !== "en") {
      return fetchWikipediaArticle(query, "en");
    }
    return null;
  }

  const pageTitle = searchResults[0]!.title;

  // 2. Fetch full extract + thumbnail
  const extractParams = new URLSearchParams({
    action: "query",
    prop: "extracts|pageimages",
    titles: pageTitle,
    format: "json",
    exintro: "false",
    explaintext: "true",
    pithumbsize: "640",
    origin: "*",
  });

  interface ExtractPage {
    title: string;
    extract?: string;
    thumbnail?: { source: string };
  }

  interface ExtractResponse {
    query?: {
      pages?: Record<string, ExtractPage>;
    };
  }

  const extractUrl = `${wikiApiUrl(lang)}?${extractParams.toString()}`;
  const extractData = await fetchJson<ExtractResponse>(extractUrl);

  const pages = extractData.query?.pages ?? {};
  const pageKeys = Object.keys(pages);
  if (pageKeys.length === 0) return null;

  const page = pages[pageKeys[0]!]!;
  const extract = page.extract ?? "";

  // 3. Fetch sections
  const sectionsParams = new URLSearchParams({
    action: "parse",
    page: pageTitle,
    prop: "sections",
    format: "json",
    origin: "*",
  });

  interface SectionEntry {
    line: string;
    level: string;
    index: string;
  }

  interface SectionsResponse {
    parse?: {
      sections?: SectionEntry[];
    };
  }

  const sectionsUrl = `${wikiApiUrl(lang)}?${sectionsParams.toString()}`;
  let sectionEntries: SectionEntry[] = [];
  try {
    const sectionsData = await fetchJson<SectionsResponse>(sectionsUrl);
    sectionEntries = sectionsData.parse?.sections ?? [];
  } catch {
    // Soft-fail: sections are optional
  }

  // 4. Parse sections from the extract text
  const sections = parseSectionsFromExtract(extract, sectionEntries);

  return {
    title: page.title,
    extract,
    url: wikiPageUrl(lang, page.title),
    thumbnail: page.thumbnail?.source,
    sections,
  };
}

// ============================================================================
// Section parsing from plaintext extract
// ============================================================================

/**
 * Parse sections from Wikipedia's plaintext extract using section headers.
 *
 * Wikipedia's explaintext format uses "== Title ==" style headers.
 */
function parseSectionsFromExtract(
  extract: string,
  sectionEntries: Array<{ line: string; level: string }>,
): WikiSection[] {
  if (!extract || sectionEntries.length === 0) {
    return extract ? [{ title: "Introduction", content: extract.slice(0, 2000) }] : [];
  }

  const sections: WikiSection[] = [];

  // Build regex patterns from section entries
  const sectionHeaders = sectionEntries
    .filter((s) => s.level === "2") // Top-level sections only
    .map((s) => s.line);

  if (sectionHeaders.length === 0) {
    return [{ title: "Introduction", content: extract.slice(0, 2000) }];
  }

  // Split extract by "== Section ==" headers
  const headerPattern = /^={2,}\s*(.+?)\s*={2,}$/gm;
  const parts: Array<{ title: string; startIdx: number }> = [];

  let match;
  while ((match = headerPattern.exec(extract)) !== null) {
    parts.push({ title: match[1]!, startIdx: match.index! });
  }

  // Introduction (before first header)
  if (parts.length > 0 && parts[0]!.startIdx > 0) {
    const introContent = extract.slice(0, parts[0]!.startIdx).trim();
    if (introContent) {
      sections.push({ title: "Introduction", content: introContent.slice(0, 2000) });
    }
  } else if (parts.length === 0) {
    sections.push({ title: "Introduction", content: extract.slice(0, 2000) });
    return sections;
  }

  // Each section
  for (let i = 0; i < parts.length; i++) {
    const start = parts[i]!.startIdx;
    const end = i + 1 < parts.length ? parts[i + 1]!.startIdx : extract.length;
    const fullBlock = extract.slice(start, end);
    // Remove the header line itself
    const content = fullBlock.replace(/^={2,}\s*.+?\s*={2,}\n?/, "").trim();
    if (content) {
      sections.push({
        title: parts[i]!.title,
        content: content.slice(0, 2000),
      });
    }
  }

  return sections;
}
