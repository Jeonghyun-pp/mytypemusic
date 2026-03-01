// ============================================================================
// Timeout wrapper
// ============================================================================

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label?: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Timeout: ${label ?? "operation"} (${String(timeoutMs)}ms)`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

// ============================================================================
// Retry with exponential backoff + jitter
// ============================================================================

export type RetryOptions = {
  retries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitter?: boolean;
  retryOn?: (err: unknown) => boolean;
};

function isRetryable(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    // Retry on timeout, network errors, or 5xx
    if (msg.includes("timeout")) return true;
    if (msg.includes("econnreset")) return true;
    if (msg.includes("econnrefused")) return true;
    if (msg.includes("fetch failed")) return true;
    if (msg.includes("5xx") || msg.includes("server error")) return true;
    // Check for status code in the error
    if ("status" in err) {
      const status = (err as { status: number }).status;
      if (status >= 500 && status < 600) return true;
      if (status === 429) return true; // rate limit
    }
  }
  return false;
}

export async function retry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions,
): Promise<T> {
  const { retries, baseDelayMs, maxDelayMs, jitter = true, retryOn } = opts;
  const shouldRetry = retryOn ?? isRetryable;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;

      if (attempt >= retries || !shouldRetry(err)) {
        throw err;
      }

      // Exponential backoff
      const expDelay = baseDelayMs * Math.pow(2, attempt);
      const capped = Math.min(expDelay, maxDelayMs);
      const delay = jitter ? capped * (0.5 + Math.random() * 0.5) : capped;

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Should not reach here, but satisfy TypeScript
  throw lastError;
}
