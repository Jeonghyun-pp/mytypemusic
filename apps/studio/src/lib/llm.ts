import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ZodType } from "zod";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

const openai = new OpenAI();

// ── Fallback provider clients (lazy init, only when API keys exist) ───

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic | null {
  if (_anthropic) return _anthropic;
  if (!process.env.ANTHROPIC_API_KEY) return null;
  _anthropic = new Anthropic();
  return _anthropic;
}

let _gemini: GoogleGenerativeAI | null = null;
function getGemini(): GoogleGenerativeAI | null {
  if (_gemini) return _gemini;
  if (!process.env.GOOGLE_AI_API_KEY) return null;
  _gemini = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
  return _gemini;
}

interface GptOpts {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  systemPrompt?: string;
  caller?: string;
}

const RETRY_DELAYS = [1000, 2000, 4000]; // 3 retries with exponential backoff
const RATE_LIMIT_DELAYS = [5000, 15000, 30000]; // longer backoff for 429s
const DEFAULT_TIMEOUT = 30_000;

/** Classify error type for smarter retry behavior. */
function classifyError(e: unknown): "rate_limit" | "timeout" | "api" | "unknown" {
  if (e instanceof Error) {
    if (e.message.includes("timeout")) return "timeout";
    if (e.message.includes("429") || e.message.includes("rate limit") || e.message.includes("Rate limit"))
      return "rate_limit";
  }
  // OpenAI SDK may attach status
  const status = (e as { status?: number })?.status;
  if (status === 429) return "rate_limit";
  if (status && status >= 500) return "api";
  return "unknown";
}

function logRetry(fn: string, attempt: number, maxAttempts: number, delay: number, errType: string, msg: string): void {
  logger.warn({ fn, attempt: attempt + 1, maxAttempts: maxAttempts + 1, errType, delay }, `LLM retry: ${msg}`);
}

function logFailure(fn: string, attempts: number, errType: string, msg: string): void {
  logger.error({ fn, attempts, errType }, `LLM failed: ${msg}`);
}

/**
 * Simple GPT call helper. Returns the raw text response.
 */
export async function callGpt(
  prompt: string,
  opts?: GptOpts,
): Promise<string> {
  const messages: { role: "system" | "user"; content: string }[] = [];
  if (opts?.systemPrompt) {
    messages.push({ role: "system", content: opts.systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  const start = Date.now();
  const completion = await openai.chat.completions.create({
    model: opts?.model ?? "gpt-4o-mini",
    temperature: opts?.temperature ?? 0.7,
    max_tokens: opts?.maxTokens ?? 2000,
    messages,
  });
  const elapsed = Date.now() - start;
  const text = completion.choices[0]?.message?.content ?? "";

  // 비용 추적 (fire-and-forget)
  if (completion.usage) {
    trackLlmUsage(opts?.model ?? "gpt-4o-mini", completion.usage, opts?.caller, elapsed).catch(() => {});
  }

  return text;
}

// ---------------------------------------------------------------------------
// Resilient variants
// ---------------------------------------------------------------------------

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`LLM timeout after ${ms}ms`)), ms);
    }),
  ]);
}

/** Strip markdown fences that GPT sometimes wraps around JSON. */
export function extractJson(raw: string): string {
  return raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
}

// ---------------------------------------------------------------------------
// Fallback provider call helpers
// ---------------------------------------------------------------------------

const CLAUDE_MODEL_MAP: Record<string, string> = {
  "gpt-4o-mini": "claude-haiku-4-5-20251001",
  "gpt-4o": "claude-sonnet-4-6",
  "gpt-4.1-mini": "claude-haiku-4-5-20251001",
  "gpt-4.1": "claude-sonnet-4-6",
};

const GEMINI_MODEL_MAP: Record<string, string> = {
  "gpt-4o-mini": "gemini-2.0-flash",
  "gpt-4o": "gemini-2.0-flash",
  "gpt-4.1-mini": "gemini-2.0-flash",
  "gpt-4.1": "gemini-2.0-flash",
};

/** Call Claude (Anthropic) as fallback. Returns text or null if unavailable. */
async function callClaude(
  prompt: string,
  opts?: GptOpts,
): Promise<string | null> {
  const client = getAnthropic();
  if (!client) return null;

  const model = CLAUDE_MODEL_MAP[opts?.model ?? "gpt-4o-mini"] ?? "claude-haiku-4-5-20251001";
  const start = Date.now();

  const msg = await client.messages.create({
    model,
    max_tokens: opts?.maxTokens ?? 2000,
    temperature: opts?.temperature ?? 0.7,
    ...(opts?.systemPrompt ? { system: opts.systemPrompt } : {}),
    messages: [{ role: "user", content: prompt }],
  });

  const elapsed = Date.now() - start;
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  // 비용 추적
  if (msg.usage) {
    trackLlmUsage(
      model,
      { prompt_tokens: msg.usage.input_tokens, completion_tokens: msg.usage.output_tokens, total_tokens: msg.usage.input_tokens + msg.usage.output_tokens },
      opts?.caller,
      elapsed,
    ).catch(() => {});
  }

  return text;
}

/** Call Gemini (Google) as fallback. Returns text or null if unavailable. */
async function callGeminiText(
  prompt: string,
  opts?: GptOpts,
): Promise<string | null> {
  const client = getGemini();
  if (!client) return null;

  const modelName = GEMINI_MODEL_MAP[opts?.model ?? "gpt-4o-mini"] ?? "gemini-2.0-flash";
  const model = client.getGenerativeModel({ model: modelName });
  const start = Date.now();

  const fullPrompt = opts?.systemPrompt
    ? `${opts.systemPrompt}\n\n${prompt}`
    : prompt;

  const result = await model.generateContent(fullPrompt);
  const elapsed = Date.now() - start;
  const text = result.response.text();

  // 비용 추적 (Gemini usage metadata)
  const usage = result.response.usageMetadata;
  if (usage) {
    trackLlmUsage(
      modelName,
      { prompt_tokens: usage.promptTokenCount ?? 0, completion_tokens: usage.candidatesTokenCount ?? 0, total_tokens: usage.totalTokenCount ?? 0 },
      opts?.caller,
      elapsed,
    ).catch(() => {});
  }

  return text;
}

/** Try fallback providers in order: Claude → Gemini. */
async function callFallback(
  prompt: string,
  opts: GptOpts | undefined,
  timeoutMs: number,
): Promise<string> {
  // Try Claude
  try {
    const claudeResult = await withTimeout(callClaude(prompt, opts).then((r) => {
      if (r === null) throw new Error("Claude unavailable (no API key)");
      return r;
    }), timeoutMs);
    logger.info({ caller: opts?.caller }, "LLM fallback: Claude succeeded");
    return claudeResult;
  } catch (e) {
    logger.warn({ caller: opts?.caller, error: String(e) }, "LLM fallback: Claude failed");
  }

  // Try Gemini
  try {
    const geminiResult = await withTimeout(callGeminiText(prompt, opts).then((r) => {
      if (r === null) throw new Error("Gemini unavailable (no API key)");
      return r;
    }), timeoutMs);
    logger.info({ caller: opts?.caller }, "LLM fallback: Gemini succeeded");
    return geminiResult;
  } catch (e) {
    logger.warn({ caller: opts?.caller, error: String(e) }, "LLM fallback: Gemini failed");
  }

  throw new Error("All LLM providers failed (OpenAI → Claude → Gemini)");
}

/**
 * Call GPT with automatic retry (3 attempts) and timeout (30s default).
 * Falls back to Claude → Gemini if OpenAI retries are exhausted.
 */
export async function callGptSafe(
  prompt: string,
  opts?: GptOpts,
): Promise<string> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      return await withTimeout(callGpt(prompt, opts), timeoutMs);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      const errType = classifyError(e);
      const delays = errType === "rate_limit" ? RATE_LIMIT_DELAYS : RETRY_DELAYS;
      const delay = delays[attempt];
      if (delay === undefined) {
        logFailure("callGptSafe", attempt + 1, errType, lastError.message);
        break;
      }
      logRetry("callGptSafe", attempt, RETRY_DELAYS.length, delay, errType, lastError.message);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  // OpenAI exhausted — try fallback providers
  logger.warn({ caller: opts?.caller }, "OpenAI retries exhausted, trying fallback providers");
  try {
    return await callFallback(prompt, opts, timeoutMs);
  } catch {
    // All providers failed — report original OpenAI error
  }

  Sentry.captureException(lastError, {
    tags: { model: opts?.model ?? "gpt-4o-mini", caller: opts?.caller },
    extra: { attempts: RETRY_DELAYS.length + 1, fallbackAttempted: true },
  });
  throw lastError ?? new Error("callGptSafe failed (all providers)");
}

/**
 * Call GPT, parse JSON response, and optionally validate with a Zod schema.
 * Handles markdown fences, retries, and timeout automatically.
 */
export async function callGptJson<T = unknown>(
  prompt: string,
  opts?: GptOpts & { schema?: ZodType<T> },
): Promise<T> {
  const raw = await callGptSafe(prompt, opts);
  const parsed = JSON.parse(extractJson(raw));
  if (opts?.schema) return opts.schema.parse(parsed) as T;
  return parsed as T;
}

// ---------------------------------------------------------------------------
// Vision API support
// ---------------------------------------------------------------------------

interface VisionImage {
  /** base64-encoded image (without data URI prefix) or full data URI */
  base64: string;
  /** OpenAI detail level — "low" (85 tokens) or "high" (765+ tokens) */
  detail?: "low" | "high" | "auto";
}

interface GptVisionOpts extends GptOpts {
  schema?: ZodType<unknown>;
}

/**
 * Call GPT with Vision (image input). Supports one or more images.
 * Returns parsed JSON validated with optional Zod schema.
 *
 * Uses gpt-4o by default (vision-capable). gpt-4o-mini does NOT support images.
 */
export async function callGptVision<T = unknown>(
  prompt: string,
  images: VisionImage[],
  opts?: GptVisionOpts,
): Promise<T> {
  if (images.length === 0) {
    throw new Error("callGptVision: at least one image is required");
  }

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: string } }
  > = [{ type: "text", text: prompt }];

  for (const img of images) {
    const url = img.base64.startsWith("data:")
      ? img.base64
      : `data:image/png;base64,${img.base64}`;
    content.push({
      type: "image_url",
      image_url: { url, detail: img.detail ?? "low" },
    });
  }

  const messages: Array<{
    role: "system" | "user";
    content: string | typeof content;
  }> = [];
  if (opts?.systemPrompt) {
    messages.push({ role: "system", content: opts.systemPrompt });
  }
  messages.push({ role: "user", content });

  const timeoutMs = opts?.timeoutMs ?? 50_000; // Vision calls take longer; 10s margin for Vercel 60s limit
  const visionStart = Date.now();
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const result = await withTimeout(
        openai.chat.completions.create({
          model: opts?.model ?? "gpt-4o",
          temperature: opts?.temperature ?? 0.3,
          max_tokens: opts?.maxTokens ?? 2000,
          messages: messages as Parameters<typeof openai.chat.completions.create>[0]["messages"],
        }),
        timeoutMs,
      );

      // 비용 추적 (fire-and-forget)
      if (result.usage) {
        trackLlmUsage(opts?.model ?? "gpt-4o", result.usage, opts?.caller, Date.now() - visionStart).catch(() => {});
      }

      const raw = result.choices[0]?.message?.content ?? "";
      const parsed = JSON.parse(extractJson(raw));
      if (opts?.schema) return opts.schema.parse(parsed) as T;
      return parsed as T;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      const errType = classifyError(e);
      const delays = errType === "rate_limit" ? RATE_LIMIT_DELAYS : RETRY_DELAYS;
      const delay = delays[attempt];
      if (delay === undefined) {
        logFailure("callGptVision", attempt + 1, errType, lastError.message);
        break;
      }
      logRetry("callGptVision", attempt, RETRY_DELAYS.length, delay, errType, lastError.message);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  // OpenAI Vision exhausted — try Claude Vision fallback
  logger.warn({ caller: opts?.caller }, "OpenAI Vision retries exhausted, trying Claude Vision");
  try {
    const claudeResult = await withTimeout(callClaudeVision(prompt, images, opts), timeoutMs);
    if (claudeResult !== null) {
      logger.info({ caller: opts?.caller }, "LLM fallback: Claude Vision succeeded");
      const parsed = JSON.parse(extractJson(claudeResult));
      if (opts?.schema) return opts.schema.parse(parsed) as T;
      return parsed as T;
    }
  } catch (e) {
    logger.warn({ caller: opts?.caller, error: String(e) }, "LLM fallback: Claude Vision failed");
  }

  Sentry.captureException(lastError, {
    tags: { model: opts?.model ?? "gpt-4o", caller: opts?.caller },
    extra: { attempts: RETRY_DELAYS.length + 1, fallbackAttempted: true },
  });
  throw lastError ?? new Error("callGptVision failed (all providers)");
}

// ---------------------------------------------------------------------------
// Claude Vision fallback
// ---------------------------------------------------------------------------

/** Call Claude with Vision as fallback for callGptVision. */
async function callClaudeVision(
  prompt: string,
  images: VisionImage[],
  opts?: GptVisionOpts,
): Promise<string | null> {
  const client = getAnthropic();
  if (!client) return null;

  const model = CLAUDE_MODEL_MAP[opts?.model ?? "gpt-4o"] ?? "claude-sonnet-4-6";
  const start = Date.now();

  const content: Anthropic.MessageCreateParams["messages"][0]["content"] = [];
  for (const img of images) {
    const isDataUri = img.base64.startsWith("data:");
    let mediaType: "image/png" | "image/jpeg" | "image/gif" | "image/webp" = "image/png";
    let b64Data = img.base64;

    if (isDataUri) {
      const match = img.base64.match(/^data:(image\/\w+);base64,(.+)$/);
      if (match) {
        mediaType = match[1] as typeof mediaType;
        b64Data = match[2]!;
      }
    }

    content.push({
      type: "image",
      source: { type: "base64", media_type: mediaType, data: b64Data },
    });
  }
  content.push({ type: "text", text: prompt });

  const msg = await client.messages.create({
    model,
    max_tokens: opts?.maxTokens ?? 2000,
    temperature: opts?.temperature ?? 0.3,
    ...(opts?.systemPrompt ? { system: opts.systemPrompt } : {}),
    messages: [{ role: "user", content }],
  });

  const elapsed = Date.now() - start;
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  if (msg.usage) {
    trackLlmUsage(
      model,
      { prompt_tokens: msg.usage.input_tokens, completion_tokens: msg.usage.output_tokens, total_tokens: msg.usage.input_tokens + msg.usage.output_tokens },
      opts?.caller,
      elapsed,
    ).catch(() => {});
  }

  return text;
}

// ---------------------------------------------------------------------------
// LLM Usage Tracking
// ---------------------------------------------------------------------------

const MODEL_RATES: Record<string, { input: number; output: number }> = {
  // OpenAI
  "gpt-4o-mini":  { input: 0.15e-6,  output: 0.60e-6 },
  "gpt-4o":       { input: 2.50e-6,  output: 10.0e-6 },
  "gpt-4.1-mini": { input: 0.40e-6,  output: 1.60e-6 },
  "gpt-4.1":      { input: 2.00e-6,  output: 8.00e-6 },
  // Anthropic (Claude)
  "claude-haiku-4-5-20251001": { input: 0.80e-6,  output: 4.00e-6 },
  "claude-sonnet-4-6":        { input: 3.00e-6,  output: 15.0e-6 },
  // Google (Gemini)
  "gemini-2.0-flash":         { input: 0.10e-6,  output: 0.40e-6 },
};

async function trackLlmUsage(
  model: string,
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number },
  caller?: string,
  durationMs?: number,
) {
  const rate = MODEL_RATES[model] ?? MODEL_RATES["gpt-4o-mini"]!;
  const cost = usage.prompt_tokens * rate.input + usage.completion_tokens * rate.output;
  await prisma.llmUsageLog.create({
    data: {
      model,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
      costUsd: Math.round(cost * 1e6) / 1e6,
      caller: caller ?? "unknown",
      durationMs,
    },
  });
}
