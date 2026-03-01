import type { ParsedIntent } from "./types.js";
import { parseIntentByRules } from "./intent-rules.js";
import { parseIntentByLLM } from "./intent-llm.js";

// ============================================================================
// Hybrid Intent Parser: Rule-based → LLM fallback
//
// 1. Try rule-based keyword matching (fast, free)
// 2. If no match, try LLM parsing (accurate, costs API call)
// 3. If both fail, default to artist_profile with the full text as artistName
// ============================================================================

export async function parseIntent(text: string): Promise<ParsedIntent> {
  // 1. Rule-based (synchronous, free)
  const ruleResult = parseIntentByRules(text);
  if (ruleResult) {
    return ruleResult;
  }

  // 2. LLM fallback
  try {
    return await parseIntentByLLM(text);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`LLM intent parsing failed: ${msg}, using default`);
  }

  // 3. Final fallback: treat entire text as artist name
  return {
    intentType: "artist_profile",
    artistName: text.trim(),
    confidence: 0.2,
    source: "rule",
  };
}
