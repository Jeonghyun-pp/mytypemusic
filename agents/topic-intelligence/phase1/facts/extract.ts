import type { ScoredArticle } from "../relevance/score.js";
import { normalizeTopic } from "../../utils/normalize.js";
import { loadJson } from "../../io/load.js";
import { getArticlesIndexPath } from "../../io/paths.js";
import type { ArticleCache } from "../article/cache.js";
import type { CoverageCluster } from "../coverage/cluster.js";
import { extractSentenceCandidatesFromBody } from "./extractFromBody.js";
import { scoreBodyFact } from "./scoreFacts.js";
import { buildEvidenceUrls } from "./evidence.js";
import { dedupeFacts } from "./dedupe.js";

// ============================================================================
// Types
// ============================================================================

export type KeyFactCandidate = {
  text: string;
  evidenceUrls: string[];
};

export type FactsOptions = {
  maxFacts?: number; // default 10
  minTextLen?: number; // default 20
  maxEvidenceUrls?: number; // default 3
};

// ============================================================================
// Helpers
// ============================================================================

/** Remove bracket content: (...), [...], {...} */
function removeBrackets(s: string): string {
  return s
    .replace(/\([^)]*\)/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\{[^}]*\}/g, "");
}

/** Remove noisy special characters commonly found in Korean news titles. */
function removeSpecialChars(s: string): string {
  return s.replace(/[•·｜|◆◇■□▶▷△▲▼▽★☆→←↑↓…「」『』《》〈〉【】]/g, "");
}

/** Normalize whitespace: collapse 2+ to 1, trim. */
function normalizeWhitespace(s: string): string {
  return s.replace(/\s{2,}/g, " ").trim();
}

/** Clean a title into a fact-ready text. */
function cleanTitle(title: string): string {
  let s = removeBrackets(title);
  s = removeSpecialChars(s);
  s = normalizeWhitespace(s);
  return s;
}

/** Tokenize text for overlap comparison. */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 0),
  );
}

// ============================================================================
// Main
// ============================================================================

/**
 * Generate key facts from selected article titles (Phase1 MVP).
 *
 * - Cleans titles (remove brackets, special chars, normalize whitespace)
 * - Collects evidence URLs from similar articles
 * - Limits output to maxFacts
 */
export function generateKeyFactsFromTitles(
  selected: ScoredArticle[],
  opts?: FactsOptions,
): KeyFactCandidate[] {
  const maxFacts = opts?.maxFacts ?? 10;
  const minTextLen = opts?.minTextLen ?? 20;
  const maxEvidenceUrls = opts?.maxEvidenceUrls ?? 3;

  // Safety: sort by score desc
  const sorted = [...selected].sort((a, b) => b.score - a.score);

  // Pre-compute tokens for all articles (for evidence matching)
  const articleTokens = sorted.map((a) => ({
    article: a,
    tokens: tokenize(normalizeTopic(a.title)),
  }));

  const facts: KeyFactCandidate[] = [];

  for (const entry of articleTokens) {
    if (facts.length >= maxFacts) break;

    const text = cleanTitle(entry.article.title);
    if (text.length < minTextLen) continue;

    // Build evidence URLs: self + similar articles
    const evidenceUrls: string[] = [entry.article.url];

    for (const other of articleTokens) {
      if (evidenceUrls.length >= maxEvidenceUrls) break;
      if (other.article.url === entry.article.url) continue;

      // Check token overlap: at least 1 shared token
      let overlap = 0;
      for (const t of entry.tokens) {
        if (other.tokens.has(t)) {
          overlap++;
          break;
        }
      }
      if (overlap > 0 && !evidenceUrls.includes(other.article.url)) {
        evidenceUrls.push(other.article.url);
      }
    }

    facts.push({ text, evidenceUrls: evidenceUrls.slice(0, maxEvidenceUrls) });
  }

  return facts;
}

// ============================================================================
// Body-based fact orchestrator (Task 8-B)
// ============================================================================

type ArticleIndexItem = {
  idx: number;
  url: string;
  title: string;
  cachePath: string;
  ok: boolean;
  error: string | null;
};

type ArticleIndex = {
  topicId: string;
  count: number;
  items: ArticleIndexItem[];
};

/**
 * Generate key facts from article bodies (preferred) or titles (fallback).
 *
 * 1) Loads article cache index; if missing → fallback to titles
 * 2) For ok=true articles with body text: extract sentences, score, dedupe
 * 3) If body produces <6 facts → fallback to titles
 */
export async function generateKeyFacts(params: {
  topicId: string;
  seedKeyword: string;
  normalizedTopic: string;
  category?: "music" | "lifestyle";
  selected: ScoredArticle[];
  clusters?: CoverageCluster[];
}): Promise<{
  keyFacts: KeyFactCandidate[];
  used: "body" | "title";
}> {
  const { topicId, seedKeyword, category, selected, clusters } = params;
  const MIN_BODY_FACTS = 6;
  const MAX_BODY_CANDIDATES = 12;
  const MAX_FINAL_FACTS = 10;

  // --- Try body-based extraction ---
  try {
    // 1) Load article cache index
    const indexPath = getArticlesIndexPath(topicId);
    const index = await loadJson<ArticleIndex>(indexPath);

    if (!index.items || index.items.length === 0) {
      return titleFallback(selected);
    }

    // 2) Load ok articles with body text
    const okItems = index.items.filter((item) => item.ok);
    if (okItems.length === 0) {
      return titleFallback(selected);
    }

    // Load each article cache file
    const articlesDir = indexPath.replace(/[/\\]index\.json$/, "");
    const allCandidates = [];

    for (const item of okItems) {
      try {
        const cachePath = `${articlesDir}/${item.cachePath}`;
        const cache = await loadJson<ArticleCache>(cachePath);

        if (!cache.content?.text || cache.content.text.length < 100) continue;

        const candidates = extractSentenceCandidatesFromBody({
          text: cache.content.text,
          sourceIdx: cache.idx,
          url: cache.url,
          category,
        });

        allCandidates.push(...candidates);
      } catch {
        // Skip individual article load failures
        continue;
      }
    }

    if (allCandidates.length === 0) {
      return titleFallback(selected);
    }

    // 3) Score all candidates
    const scored = allCandidates.map((c) =>
      scoreBodyFact(c, seedKeyword, category),
    );

    // 4) Sort by score desc, take top candidates
    scored.sort((a, b) => b.score - a.score);
    const topCandidates = scored.slice(0, MAX_BODY_CANDIDATES);

    // 5) Build evidence URLs (with cluster enhancement)
    const selectedSources = selected.map((a) => ({
      url: a.url,
      title: a.title,
      publisher: a.publisher,
    }));
    const withEvidence = buildEvidenceUrls(topCandidates, selectedSources, {
      preferClusterUrls: true,
      clusters,
    });

    // 6) Dedupe via Jaccard
    const asKeyFacts: KeyFactCandidate[] = withEvidence.map((e) => ({
      text: e.text,
      evidenceUrls: e.evidenceUrls,
    }));
    const deduped = dedupeFacts(asKeyFacts);

    // 7) Check minimum threshold
    if (deduped.length < MIN_BODY_FACTS) {
      return titleFallback(selected);
    }

    return {
      keyFacts: deduped.slice(0, MAX_FINAL_FACTS),
      used: "body",
    };
  } catch {
    // Index load failure or unexpected error → fallback
    return titleFallback(selected);
  }
}

/** Title-based fallback (original Phase1 MVP). */
function titleFallback(selected: ScoredArticle[]): {
  keyFacts: KeyFactCandidate[];
  used: "body" | "title";
} {
  const raw = generateKeyFactsFromTitles(selected);
  const deduped = dedupeFacts(raw);
  return { keyFacts: deduped, used: "title" };
}
