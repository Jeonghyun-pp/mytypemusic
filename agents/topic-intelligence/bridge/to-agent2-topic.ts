import type { TopicIntelPack, TopicRequest } from "../contracts.js";

// ============================================================================
// Types (local — not added to contracts.ts)
// ============================================================================

export interface Agent2Topic {
  title: string;
  category: "music" | "lifestyle";
  facts: string[];
  angles: string[];
  sources: Array<{ title: string; url: string }>;
}

// ============================================================================
// Helpers
// ============================================================================

function uniqueStrings(arr: string[], max: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const s of arr) {
    if (result.length >= max) break;
    if (!seen.has(s)) {
      seen.add(s);
      result.push(s);
    }
  }
  return result;
}

// ============================================================================
// Main
// ============================================================================

/**
 * Convert TopicIntelPack → Agent2Topic JSON.
 *
 * Throws if request.category is missing (bridge requires explicit category).
 */
export function toAgent2Topic(
  intel: TopicIntelPack,
  request: TopicRequest,
): Agent2Topic {
  // Category: must be "music" | "lifestyle"
  if (request.category !== "music" && request.category !== "lifestyle") {
    throw new Error(
      "Category missing in TopicRequest. Re-run Phase0 with --category music|lifestyle.",
    );
  }

  // title
  const title = intel.normalizedTopic;

  // facts: keyFacts.text, dedupe exact, top 8
  const facts = uniqueStrings(
    intel.keyFacts.map((f) => f.text),
    8,
  );

  // angles: dedupe exact, top 6
  const angles = uniqueStrings(intel.angleCandidates, 6);

  // sources: {title,url}, dedupe by url, top 5
  const sources: Agent2Topic["sources"] = [];
  const seenUrls = new Set<string>();
  for (const s of intel.sources) {
    if (sources.length >= 5) break;
    if (!seenUrls.has(s.url)) {
      seenUrls.add(s.url);
      sources.push({ title: s.title, url: s.url });
    }
  }

  return { title, category: request.category, facts, angles, sources };
}
