export type FetchFeedOptions = {
  timeoutMs?: number;
  userAgent?: string;
};

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_USER_AGENT = "topic-intel/1.0";

/**
 * Fetch raw XML from a feed URL.
 *
 * - Uses Node 18+ global fetch
 * - AbortController for timeout
 * - Throws on non-2xx status
 */
export async function fetchFeedXml(
  url: string,
  opts?: FetchFeedOptions,
): Promise<string> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const userAgent = opts?.userAgent ?? DEFAULT_USER_AGENT;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": userAgent },
    });

    if (!res.ok) {
      throw new Error(
        `Feed fetch failed: ${url} responded with HTTP ${String(res.status)}`,
      );
    }

    return await res.text();
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Feed fetch timed out after ${String(timeoutMs)}ms: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
