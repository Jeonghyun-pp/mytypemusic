import OpenAI from "openai";
import type { SpotifyIntentType, ParsedIntent } from "./types.js";

// ============================================================================
// LLM Fallback Intent Parser
//
// When rule-based parsing fails (no keyword matches), use OpenAI to parse
// natural language into a structured ParsedIntent.
//
// Env: OPENAI_API_KEY
// Model: gpt-4o-mini (cost-efficient for structured extraction)
// ============================================================================

const VALID_INTENT_TYPES: SpotifyIntentType[] = [
  "album_detail",
  "new_releases",
  "top_tracks",
  "artist_compare",
  "related_artists",
  "mood_playlist",
  "discography",
  "track_analysis",
  "artist_profile",
];

const SYSTEM_PROMPT = `You are a Spotify intent parser for a Korean music magazine automation system.
Given user text (Korean or English), extract the user's intent for Spotify data retrieval.

Return a JSON object with these fields:
- intentType: one of [${VALID_INTENT_TYPES.join(", ")}]
- artistName: artist/band name if mentioned (original language)
- albumName: album name if mentioned
- trackName: track name if mentioned
- compareWith: second artist name if intent is artist_compare
- mood: mood keyword if intent is mood_playlist (e.g. "잔잔한", "신나는")
- limit: number if a count is mentioned (e.g. "TOP 5" → 5)
- confidence: 0 to 1, your confidence in the parsing

Return ONLY valid JSON, no markdown or explanation.`;

export async function parseIntentByLLM(text: string): Promise<ParsedIntent> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY must be set for LLM intent parsing");
  }

  const client = new OpenAI({ apiKey });

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: text },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from OpenAI intent parser");
  }

  const parsed = JSON.parse(content) as Record<string, unknown>;

  // Validate intentType
  const intentType = parsed.intentType as string;
  if (!VALID_INTENT_TYPES.includes(intentType as SpotifyIntentType)) {
    // Fallback to artist_profile if LLM returns an invalid type
    return {
      intentType: "artist_profile",
      artistName: (parsed.artistName as string) ?? undefined,
      confidence: 0.3,
      source: "llm",
    };
  }

  return {
    intentType: intentType as SpotifyIntentType,
    artistName: (parsed.artistName as string) ?? undefined,
    albumName: (parsed.albumName as string) ?? undefined,
    trackName: (parsed.trackName as string) ?? undefined,
    compareWith: (parsed.compareWith as string) ?? undefined,
    mood: (parsed.mood as string) ?? undefined,
    limit: typeof parsed.limit === "number" ? parsed.limit : undefined,
    confidence: typeof parsed.confidence === "number"
      ? Math.min(Math.max(parsed.confidence, 0), 1)
      : 0.7,
    source: "llm",
  };
}
