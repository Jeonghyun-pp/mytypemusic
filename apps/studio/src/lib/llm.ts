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
const DEFAULT_TIMEOUT = 30_000;

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
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`LLM timeout after ${ms}ms`)), ms),
    ),
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
      const delay = RETRY_DELAYS[attempt];
      if (delay === undefined) break;
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
