import OpenAI from "openai";
import type { ZodType } from "zod";

const openai = new OpenAI();

interface GptOpts {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  systemPrompt?: string;
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
  console.warn(`[LLM] ${fn} attempt ${attempt + 1}/${maxAttempts + 1} failed (${errType}): ${msg} — retrying in ${delay}ms`);
}

function logFailure(fn: string, attempts: number, errType: string, msg: string): void {
  console.error(`[LLM] ${fn} failed after ${attempts} attempts (${errType}): ${msg}`);
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

  const completion = await openai.chat.completions.create({
    model: opts?.model ?? "gpt-4o-mini",
    temperature: opts?.temperature ?? 0.7,
    max_tokens: opts?.maxTokens ?? 2000,
    messages,
  });
  return completion.choices[0]?.message?.content ?? "";
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

/**
 * Call GPT with automatic retry (3 attempts) and timeout (30s default).
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
  throw lastError ?? new Error("callGptSafe failed");
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

  const timeoutMs = opts?.timeoutMs ?? 60_000; // Vision calls take longer
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
  throw lastError ?? new Error("callGptVision failed");
}
