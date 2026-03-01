import type { JSONLLMProvider } from "./types.js";
import { createOpenAIProvider } from "./openai.js";
import { createMockProvider } from "./mock.js";

// ============================================================================
// Provider factory
// ============================================================================

export function getProvider(
  name: "openai" | "anthropic" | "mock",
): JSONLLMProvider {
  switch (name) {
    case "openai":
    case "anthropic":
      // All LLM calls unified to OpenAI
      return createOpenAIProvider();
    case "mock":
      return createMockProvider();
    default: {
      const _never: never = name;
      throw new Error(`Unknown provider: ${String(_never)}`);
    }
  }
}

export type { JSONLLMProvider, GenerateJSONParams, GenerateJSONResult, LLMMessage } from "./types.js";
