import type { RewriteConfig, RewriteProvider } from "./contracts.js";

// ============================================================================
// Default model per provider
// ============================================================================

const DEFAULT_MODELS: Record<RewriteProvider, string> = {
  openai: "gpt-4o-mini",
  anthropic: "gpt-4o-mini", // Unified to OpenAI
  mock: "mock",
};

// ============================================================================
// Defaults
// ============================================================================

export function getDefaultRewriteConfig(): RewriteConfig {
  return {
    mode: "off",
    provider: "openai",
    model: DEFAULT_MODELS["openai"],
    temperature: 0.2,
    maxRetries: 2,
    timeoutMs: 15_000,
    enforceProfiles: true,
    forbidNewFacts: true,
    forbidEntityChanges: true,
  };
}

// ============================================================================
// Resolver — merges partial overrides onto defaults
// ============================================================================

export function resolveRewriteConfig(
  partial?: Partial<RewriteConfig>,
): RewriteConfig {
  const defaults = getDefaultRewriteConfig();

  if (!partial) return defaults;

  const merged: RewriteConfig = { ...defaults, ...partial };

  // If provider changed but model was NOT explicitly overridden,
  // use the default model for the new provider.
  if (partial.provider && !partial.model) {
    merged.model = DEFAULT_MODELS[merged.provider];
  }

  // Generate mode benefits from slightly higher temperature for creative writing.
  if (merged.mode === "generate" && partial.temperature === undefined) {
    merged.temperature = 0.5;
  }

  return merged;
}
