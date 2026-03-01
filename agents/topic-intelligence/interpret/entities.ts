// ============================================================================
// Entity extraction from Korean natural-language prompts
//
// Implements entity-salience concepts (Google Research) adapted for Korean:
// - Segment splitting by punctuation
// - Korean particle (조사) stripping
// - Possessive (의) and conjunction (와/과) pattern detection
// - Multi-query generation for Google News search
// ============================================================================

export interface PromptEntities {
  primaryTopic: string;        // e.g. "인디밴드 봄 3대장"
  entities: string[];          // e.g. ["쏜애플", "한로로", "새소년"]
  descriptors: string[];       // e.g. ["시퍼런 봄", "입춘", "난춘"]
  searchQueries: string[];     // Google News search queries (max 8)
}

// ============================================================================
// Korean particle stripping
// ============================================================================

/**
 * Common Korean particles (조사) — ordered longest-first for greedy match.
 *
 * Covers:
 *  - Subject/topic: 은/는/이/가
 *  - Object: 을/를
 *  - Conjunctive: 과/와
 *  - Possessive: 의
 *  - Locative: 에서/에
 *  - Others: 도, 만, 까지, 부터, 으로, 로
 */
const PARTICLES_RE = /(?:에서|까지|부터|으로|은|는|이|가|을|를|과|와|의|에|도|만|로)$/;

/** Strip trailing Korean particles from a word. */
export function stripParticles(word: string): string {
  return word.replace(PARTICLES_RE, "") || word;
}

// ============================================================================
// Entity extraction
// ============================================================================

/**
 * Extract entities, descriptors, and generate search queries from a prompt.
 *
 * Parsing logic:
 *  1. Split by comma, period, semicolon into segments
 *  2. First segment → primaryTopic
 *  3. Subsequent segments: detect possessive (의) or conjunction (와/과) patterns
 *  4. Single-segment fallback: extract first token as entity
 *  5. Generate up to 8 unique search queries
 */
export function extractEntities(prompt: string): PromptEntities {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return { primaryTopic: "", entities: [], descriptors: [], searchQueries: [] };
  }

  // 1. Segment by comma, period, semicolon
  const segments = trimmed
    .split(/[,;.]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return { primaryTopic: trimmed, entities: [], descriptors: [], searchQueries: [trimmed] };
  }

  const primaryTopic = segments[0]!;

  // Multi-segment: extract entities from segments 2+
  if (segments.length > 1) {
    return extractFromMultipleSegments(primaryTopic, segments.slice(1));
  }

  // Single segment: try patterns within it, then fall back to first-token
  return extractFromSingleSegment(primaryTopic);
}

// ============================================================================
// Internal helpers
// ============================================================================

function extractFromMultipleSegments(
  primaryTopic: string,
  rest: string[],
): PromptEntities {
  const entities: string[] = [];
  const descriptors: string[] = [];

  for (const seg of rest) {
    // Possessive pattern: "쏘애플의 시퍼런 봄"
    const possessiveMatch = /^(.+?)의\s+(.+)$/.exec(seg);
    if (possessiveMatch) {
      entities.push(possessiveMatch[1]!.trim());
      descriptors.push(possessiveMatch[2]!.trim());
      continue;
    }

    // Conjunction pattern: "BTS와 아이유" or "BTS과 아이유"
    const conjunctionMatch = /^(.+?)(?:와|과)\s*(.+)$/.exec(seg);
    if (conjunctionMatch) {
      entities.push(stripParticles(conjunctionMatch[1]!.trim()));
      entities.push(stripParticles(conjunctionMatch[2]!.trim()));
      continue;
    }

    // Plain entity — strip particles
    const stripped = stripParticles(seg.trim());
    if (stripped) entities.push(stripped);
  }

  const uniqueEntities = dedupe(entities);
  const uniqueDescriptors = dedupe(descriptors);

  // Build search queries
  const queries: string[] = [];

  // Each entity standalone
  for (const e of uniqueEntities) {
    queries.push(e);
  }

  // Entity + descriptor combos
  for (let i = 0; i < uniqueEntities.length && i < uniqueDescriptors.length; i++) {
    queries.push(`${uniqueEntities[i]} ${uniqueDescriptors[i]}`);
  }

  // primaryTopic
  queries.push(primaryTopic);

  return {
    primaryTopic,
    entities: uniqueEntities,
    descriptors: uniqueDescriptors,
    searchQueries: dedupeQueries(queries).slice(0, 8),
  };
}

function extractFromSingleSegment(segment: string): PromptEntities {
  // Try possessive within single segment: "쏜애플의 시퍼런 봄"
  const possessiveMatch = /^(.+?)의\s+(.+)$/.exec(segment);
  if (possessiveMatch) {
    const entity = possessiveMatch[1]!.trim();
    const descriptor = possessiveMatch[2]!.trim();
    return {
      primaryTopic: segment,
      entities: [entity],
      descriptors: [descriptor],
      searchQueries: dedupeQueries([segment, `${entity} ${descriptor}`, entity]).slice(0, 8),
    };
  }

  // Try conjunction: "BTS와 아이유"
  const conjunctionMatch = /^(.+?)(?:와|과)\s*(.+)$/.exec(segment);
  if (conjunctionMatch) {
    const e1 = stripParticles(conjunctionMatch[1]!.trim());
    const e2 = stripParticles(conjunctionMatch[2]!.trim());
    const entities = dedupe([e1, e2]);
    return {
      primaryTopic: segment,
      entities,
      descriptors: [],
      searchQueries: dedupeQueries([segment, ...entities]).slice(0, 8),
    };
  }

  // Fallback: first space-delimited token = entity
  const tokens = segment.split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) {
    // Single word — entity is the word itself
    const entity = stripParticles(segment);
    return {
      primaryTopic: segment,
      entities: [entity],
      descriptors: [],
      searchQueries: dedupeQueries([segment, entity]).slice(0, 8),
    };
  }

  // Multi-word single segment: first token = entity, rest = implicit descriptor
  const entity = stripParticles(tokens[0]!);
  return {
    primaryTopic: segment,
    entities: [entity],
    descriptors: [],
    searchQueries: dedupeQueries([segment, entity]).slice(0, 8),
  };
}

function dedupe(arr: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of arr) {
    if (item && !seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }
  return result;
}

function dedupeQueries(queries: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const q of queries) {
    const normalized = q.trim();
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result;
}
