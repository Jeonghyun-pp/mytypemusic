// ============================================================================
// Types
// ============================================================================

export type ImageQueryOptions = {
  maxQueries?: number; // default 8
};

// ============================================================================
// Main
// ============================================================================

/**
 * Generate image search queries for a topic.
 *
 * - Always includes 2 copyright-safe queries
 * - Category-specific queries for music / lifestyle
 * - Deduplicates, max 8
 */
export function generateImageQueries(
  seedKeyword: string,
  normalizedTopic: string,
  category: "music" | "lifestyle" | undefined,
  opts?: ImageQueryOptions,
): string[] {
  const maxQueries = opts?.maxQueries ?? 8;

  const queries: string[] = [];

  // Copyright-safe queries (always included)
  queries.push(`${normalizedTopic} concept illustration`);
  queries.push(`${normalizedTopic} generic background photo`);

  // Category-specific queries
  if (category === "music") {
    queries.push(`${seedKeyword} live concert photo`);
    queries.push(`${seedKeyword} stage performance`);
    queries.push(`${seedKeyword} tour announcement`);
    queries.push(`${seedKeyword} band promo photo`);
  } else if (category === "lifestyle") {
    queries.push(`${seedKeyword} korea trend`);
    queries.push(`${seedKeyword} aesthetic photo`);
    queries.push(`${seedKeyword} flatlay`);
    queries.push(`${seedKeyword} infographic`);
  } else {
    // Generic fallback
    queries.push(`${seedKeyword} editorial photo`);
    queries.push(`${seedKeyword} news illustration`);
    queries.push(`${seedKeyword} stock photo`);
    queries.push(`${seedKeyword} infographic`);
  }

  // Additional generic
  queries.push(`${normalizedTopic} abstract design`);
  queries.push(`${normalizedTopic} minimalist graphic`);

  // Deduplicate
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const q of queries) {
    const lower = q.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      unique.push(q);
    }
  }

  return unique.slice(0, maxQueries);
}
