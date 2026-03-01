import type { ContentPlan } from "../contracts.js";

// ============================================================================
// Rewrite mode & provider
// ============================================================================

export type RewriteMode = "off" | "slides" | "caption" | "all" | "generate";

export type RewriteProvider = "openai" | "anthropic" | "mock";

// ============================================================================
// RewriteConfig — controls how the LLM rewrite behaves
// ============================================================================

export type RewriteConfig = {
  mode: RewriteMode;
  provider: RewriteProvider;
  model: string;
  temperature: number;
  maxRetries: number;
  timeoutMs: number;

  /** When true, enforce length profiles from 12-D (PROFILES) */
  enforceProfiles: boolean;

  /** When true, LLM must not introduce facts absent from keyFacts */
  forbidNewFacts: boolean;
  /** When true, LLM must not change numbers/dates/proper-nouns */
  forbidEntityChanges: boolean;
};

// ============================================================================
// RewriteInput — what the rewrite module receives
// ============================================================================

export type RewriteInput = {
  topicId: string;
  category: "music" | "lifestyle";
  depth: "news" | "explainer" | "analysis";

  /** Draft content to be rewritten */
  contentPlan: ContentPlan;
  captionDraft?: string;

  /** Evidence context (read-only — rewrite must NOT mutate these) */
  keyFacts: Array<{ text: string; evidenceUrls: string[] }>;
  angleCandidates?: string[];
  riskNotes?: string[];
};

// ============================================================================
// RewriteOutput — what the rewrite module returns
// ============================================================================

export type RewriteOutput = {
  /** Rewritten content (same shape as input ContentPlan) */
  contentPlan: ContentPlan;
  captionText?: string;

  /** Metadata */
  provider: RewriteProvider;
  model: string;
  mode: RewriteMode;
  appliedAt: string; // ISO timestamp
};
