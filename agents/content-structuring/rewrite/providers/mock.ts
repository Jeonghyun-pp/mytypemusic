import type {
  JSONLLMProvider,
  GenerateJSONParams,
  GenerateJSONResult,
} from "./types.js";

// ============================================================================
// Mock provider — returns a fixed valid JSON response (no network)
//
// Detects the target (slides vs caption) from user prompt content and
// returns the matching response shape expected by runner.ts:
//   slides: { slides: [{headline, bullets?, note?}, ...] }
//   caption: { captionText: "..." }
// ============================================================================

function detectTarget(params: GenerateJSONParams): "slides" | "caption" {
  const userMsg = params.messages.find((m) => m.role === "user");
  if (
    userMsg &&
    (userMsg.content.includes("INPUT_SLIDES") ||
      userMsg.content.includes("SLIDE_STRUCTURE"))
  ) {
    return "slides";
  }
  return "caption";
}

function extractSlideCount(params: GenerateJSONParams): number {
  const userMsg = params.messages.find((m) => m.role === "user");
  if (!userMsg) return 4;

  // Try to find "Return exactly N slides" from the prompt
  const match = /Return exactly (\d+) slides/.exec(userMsg.content);
  if (match?.[1]) {
    return Number(match[1]);
  }

  // Try to find INPUT_SLIDES array length
  const arrayMatch = /"index":\s*(\d+)/g;
  let maxIndex = -1;
  let m: RegExpExecArray | null;
  while ((m = arrayMatch.exec(userMsg.content)) !== null) {
    const idx = Number(m[1]);
    if (idx > maxIndex) maxIndex = idx;
  }
  return maxIndex >= 0 ? maxIndex + 1 : 4;
}

function extractHeadlines(params: GenerateJSONParams, count: number): string[] {
  const userMsg = params.messages.find((m) => m.role === "user");
  if (!userMsg) return new Array(count).fill("Mock Headline");

  // Extract headlines from INPUT_SLIDES
  const headlinePattern = /"headline":\s*"([^"]+)"/g;
  const headlines: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = headlinePattern.exec(userMsg.content)) !== null) {
    if (m[1]) headlines.push(m[1]);
  }

  // Pad with defaults if needed
  while (headlines.length < count) {
    headlines.push("Mock Headline");
  }

  return headlines.slice(0, count);
}

export function createMockProvider(): JSONLLMProvider {
  return {
    name: "mock",

    async generateJSON(params: GenerateJSONParams): Promise<GenerateJSONResult> {
      const target = detectTarget(params);

      let mockOutput: unknown;

      if (target === "slides") {
        const count = extractSlideCount(params);
        const headlines = extractHeadlines(params, count);

        // Return same slide count with original headlines (pass-through mock)
        const slides = headlines.map((headline) => ({
          headline,
          bullets: ["Mock bullet 1", "Mock bullet 2"],
        }));

        mockOutput = { slides };
      } else {
        // caption target
        mockOutput = { captionText: "Mock caption text for testing." };
      }

      const jsonText = JSON.stringify(mockOutput);

      return {
        rawText: jsonText,
        jsonText,
        usage: { inputTokens: 0, outputTokens: 0 },
      };
    },
  };
}
