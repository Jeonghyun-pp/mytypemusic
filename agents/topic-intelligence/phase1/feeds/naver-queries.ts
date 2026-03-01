// ============================================================================
// Naver Search query plan builder
//
// Replaces the static KR_FEEDS list + Google News dynamic search.
// Generates targeted search queries from seed keyword and entities.
// ============================================================================

export interface NaverQuery {
  query: string;
  display: number;        // items to request (1-100)
  sort: "date" | "sim";
  feedId: string;         // for NormalizedArticle.feedId traceability
  feedTitle: string;      // for NormalizedArticle.feedTitle
}

export interface NaverQueryPlan {
  queries: NaverQuery[];
}

const MUSIC_SUFFIXES = ["앨범", "콘서트"];
const LIFESTYLE_SUFFIXES = ["트렌드", "추천"];

/**
 * Build a set of Naver news search queries from topic request parameters.
 *
 * Strategy:
 *  1. Primary: seedKeyword (display=100, sort=date)
 *  2. Each searchEntity (display=50, sort=date)
 *  3. Top 3 alignedKeywords excluding seed (display=30, sort=date)
 *  4. Category-specific supplemental queries (display=30, sort=sim)
 */
export function buildNaverQueryPlan(params: {
  seedKeyword: string;
  searchEntities?: string[];
  alignedKeywords?: string[];
  category?: string;
}): NaverQueryPlan {
  const { seedKeyword, searchEntities, alignedKeywords, category } = params;
  const queries: NaverQuery[] = [];
  const seen = new Set<string>();

  // Helper to avoid duplicate queries
  function add(q: NaverQuery): void {
    const key = q.query.toLowerCase().trim();
    if (seen.has(key) || !key) return;
    seen.add(key);
    queries.push(q);
  }

  // 1. Primary keyword
  add({
    query: seedKeyword,
    display: 100,
    sort: "date",
    feedId: `naver-news:seed`,
    feedTitle: `Naver News: ${seedKeyword}`,
  });

  // 2. Search entities
  if (searchEntities) {
    for (const entity of searchEntities) {
      add({
        query: entity,
        display: 50,
        sort: "date",
        feedId: `naver-news:entity:${entity}`,
        feedTitle: `Naver News: ${entity}`,
      });
    }
  }

  // 3. Top 3 aligned keywords (from Spotify prefetch or other enrichment)
  if (alignedKeywords) {
    const filtered = alignedKeywords
      .filter((kw) => kw.toLowerCase().trim() !== seedKeyword.toLowerCase().trim())
      .slice(0, 3);

    for (const kw of filtered) {
      add({
        query: kw,
        display: 30,
        sort: "date",
        feedId: `naver-news:aligned:${kw}`,
        feedTitle: `Naver News: ${kw}`,
      });
    }
  }

  // 4. Category-specific supplemental queries
  const suffixes =
    category === "music" ? MUSIC_SUFFIXES
    : category === "lifestyle" ? LIFESTYLE_SUFFIXES
    : [];

  for (const suffix of suffixes) {
    add({
      query: `${seedKeyword} ${suffix}`,
      display: 30,
      sort: "sim",
      feedId: `naver-news:category:${suffix}`,
      feedTitle: `Naver News: ${seedKeyword} ${suffix}`,
    });
  }

  return { queries };
}
