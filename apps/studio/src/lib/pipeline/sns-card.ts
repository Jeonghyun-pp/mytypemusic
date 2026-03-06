/**
 * SNS Card Image Generator — branded quote/key-sentence images.
 *
 * Uses LLM to extract key quotes from article content,
 * then generates card image data for rendering via next/og ImageResponse.
 */
import { callGptJson } from "@/lib/llm";

export interface SnsCardData {
  quote: string;
  attribution?: string;
  category: string;
  layout: "centered" | "left-aligned" | "split";
  colorScheme: "dark" | "light" | "accent";
  backgroundGradient: [string, string];
  accentColor: string;
  fontSize: number;
}

interface ExtractQuotesOptions {
  content: string;
  topic: string;
  maxQuotes?: number;
  brandColor?: string;
}

/**
 * Extract shareable quotes/key sentences from article content.
 */
export async function extractSnsQuotes(
  opts: ExtractQuotesOptions,
): Promise<SnsCardData[]> {
  const maxQuotes = opts.maxQuotes ?? 5;

  const result = await callGptJson<{ cards: SnsCardData[] }>(
    `Extract ${maxQuotes} most shareable, impactful quotes or key sentences from this article.
Each quote should work as a standalone SNS image card.
IMPORTANT: Quotes must be in Korean (한국어). Extract directly from the article or rephrase in Korean.

Topic: ${opts.topic}
Content:
${opts.content.slice(0, 3000)}

For each quote, decide the best visual presentation:
- layout: "centered" (short punchy quotes), "left-aligned" (longer insights), "split" (with category label)
- colorScheme: "dark" (dramatic), "light" (clean), "accent" (brand-focused)
- backgroundGradient: two hex colors for gradient [start, end]
- accentColor: one hex color for highlights${opts.brandColor ? ` (prefer variations of ${opts.brandColor})` : ""}
- fontSize: 32-64 based on text length (shorter = bigger)
- category: short topic label (2-3 words, Korean)

Return JSON:
{
  "cards": [
    {
      "quote": "the quote text",
      "attribution": "optional source or article title",
      "category": "topic label",
      "layout": "centered",
      "colorScheme": "dark",
      "backgroundGradient": ["#1a1a2e", "#16213e"],
      "accentColor": "#e94560",
      "fontSize": 48
    }
  ]
}`,
    { model: "gpt-4o-mini", temperature: 0.6 },
  );

  return result.cards.slice(0, maxQuotes);
}

// ── Card rendering dimensions ───────────────────────────

export const CARD_SIZES = {
  instagram: { width: 1080, height: 1080 },
  instagramStory: { width: 1080, height: 1920 },
  twitter: { width: 1200, height: 675 },
  facebook: { width: 1200, height: 630 },
  og: { width: 1200, height: 630 },
} as const;

export type CardPlatform = keyof typeof CARD_SIZES;

/**
 * Build the JSX element structure for a card (used by next/og ImageResponse).
 * Returns a plain object describing the card layout for the API route to render.
 */
export function buildCardStyle(
  card: SnsCardData,
  platform: CardPlatform = "instagram",
): {
  size: { width: number; height: number };
  card: SnsCardData;
  platform: CardPlatform;
} {
  return {
    size: CARD_SIZES[platform],
    card,
    platform,
  };
}
