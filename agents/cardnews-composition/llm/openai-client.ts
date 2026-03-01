// ============================================================================
// OpenAI Chat Completions API client for slide plan generation
// Fetch-based, no SDK dependency
// ============================================================================

const DEFAULT_MODEL = "gpt-4o";
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 3000;

// ── Types ──────────────────────────────────────────────────────

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LLMCallOptions = {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
};

export type LLMCallResult = {
  text: string;
  usage?: { inputTokens?: number; outputTokens?: number };
};

// ── Internal types ─────────────────────────────────────────────

type OpenAIRequestBody = {
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  max_tokens: number;
  temperature: number;
  response_format?: { type: "json_object" };
};

type OpenAIResponse = {
  choices: Array<{ message: { content: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

// ── Helpers ────────────────────────────────────────────────────

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}.\n` +
        `Set it before running (e.g. export ${key}=sk-...).`,
    );
  }
  return value;
}

class OpenAIError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "OpenAIError";
    this.status = status;
  }
}

function isRetryable(err: unknown): boolean {
  if (err instanceof OpenAIError) {
    if (err.status >= 500) return true;
    if (err.status === 429) return true;
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes("timeout")) return true;
    if (msg.includes("econnreset")) return true;
    if (msg.includes("fetch failed")) return true;
  }
  return false;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Timeout: ${label} (${String(timeoutMs)}ms)`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

// ── Core call ──────────────────────────────────────────────────

async function callOpenAI(
  apiKey: string,
  baseUrl: string,
  body: OpenAIRequestBody,
): Promise<OpenAIResponse> {
  const url = `${baseUrl}/chat/completions`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new OpenAIError(
      res.status,
      `OpenAI API error ${String(res.status)}: ${text}`,
    );
  }

  return (await res.json()) as OpenAIResponse;
}

// ── JSON extraction ────────────────────────────────────────────

function extractJSON(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return trimmed;

  const fenceMatch = /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/.exec(trimmed);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();

  return trimmed;
}

// ── Public API ─────────────────────────────────────────────────

/**
 * Call OpenAI Chat Completions API and return JSON text.
 * Includes retry with exponential backoff.
 */
export async function callOpenAIJSON(
  messages: ChatMessage[],
  opts?: LLMCallOptions,
): Promise<LLMCallResult> {
  const apiKey = requireEnv("OPENAI_API_KEY");
  const baseUrl = process.env["OPENAI_BASE_URL"] ?? "https://api.openai.com/v1";

  const model = opts?.model ?? DEFAULT_MODEL;
  const maxTokens = opts?.maxTokens ?? DEFAULT_MAX_TOKENS;
  const temperature = opts?.temperature ?? DEFAULT_TEMPERATURE;
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // Append JSON instruction to system message
  const enrichedMessages = messages.map((m) => {
    if (m.role === "system") {
      return {
        ...m,
        content: m.content + "\n\nIMPORTANT: You MUST respond with ONLY a valid JSON object. No markdown, no explanation, no wrapping — just raw JSON.",
      };
    }
    return m;
  });

  const body: OpenAIRequestBody = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages: enrichedMessages,
    response_format: { type: "json_object" },
  };

  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await withTimeout(
        callOpenAI(apiKey, baseUrl, body),
        timeoutMs,
        "OpenAI slide-plan",
      );

      const rawText = response.choices[0]?.message.content ?? "";

      return {
        text: extractJSON(rawText),
        usage: {
          inputTokens: response.usage?.prompt_tokens,
          outputTokens: response.usage?.completion_tokens,
        },
      };
    } catch (err) {
      lastError = err;
      if (attempt >= MAX_RETRIES || !isRetryable(err)) throw err;

      const expDelay = BASE_DELAY_MS * Math.pow(2, attempt);
      const capped = Math.min(expDelay, MAX_DELAY_MS);
      const delay = capped * (0.5 + Math.random() * 0.5);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
