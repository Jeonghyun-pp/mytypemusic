/**
 * Simple sliding-window rate limiter.
 *
 * Usage:
 *   const limiter = createRateLimiter({ maxCalls: 5, windowMs: 1000 });
 *   await limiter.acquire(); // waits if over limit
 */

export interface RateLimiterOptions {
  /** Max calls allowed within the window. */
  maxCalls: number;
  /** Window size in milliseconds. */
  windowMs: number;
}

export interface RateLimiter {
  /** Wait until a slot is available, then consume it. */
  acquire(): Promise<void>;
  /** Current number of calls in the window (for logging). */
  usage(): number;
}

export function createRateLimiter(opts: RateLimiterOptions): RateLimiter {
  const { maxCalls, windowMs } = opts;
  const timestamps: number[] = [];

  function prune(): void {
    const cutoff = Date.now() - windowMs;
    while (timestamps.length > 0 && timestamps[0]! < cutoff) {
      timestamps.shift();
    }
  }

  async function acquire(): Promise<void> {
    prune();
    if (timestamps.length < maxCalls) {
      timestamps.push(Date.now());
      return;
    }
    // Wait until the oldest call expires
    const oldest = timestamps[0]!;
    const waitMs = oldest + windowMs - Date.now() + 1;
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    prune();
    timestamps.push(Date.now());
  }

  function usage(): number {
    prune();
    return timestamps.length;
  }

  return { acquire, usage };
}
