import type { RewriteConfig } from "../contracts.js";

// ============================================================================
// LLM message format (chat-style)
// ============================================================================

export type LLMMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

// ============================================================================
// generateJSON params & result
// ============================================================================

export type GenerateJSONParams = {
  config: RewriteConfig;
  messages: LLMMessage[];
};

export type GenerateJSONResult = {
  rawText: string;
  jsonText: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
};

// ============================================================================
// Provider interface
// ============================================================================

export interface JSONLLMProvider {
  name: "openai" | "anthropic" | "mock";
  generateJSON(params: GenerateJSONParams): Promise<GenerateJSONResult>;
}
