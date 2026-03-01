// ============================================================================
// Types
// ============================================================================

export type FetchHtmlOptions = {
  timeoutMs?: number; // default 10000
  userAgent?: string; // default "topic-intel/1.0"
  maxBytes?: number; // default 1_500_000 (1.5MB)
};

// ============================================================================
// Main
// ============================================================================

/**
 * Fetch raw HTML from a URL.
 *
 * - AbortController timeout
 * - Status 200-299 required
 * - Content-Type must be text/html
 * - Streaming maxBytes limit
 */
export async function fetchHtml(
  url: string,
  opts?: FetchHtmlOptions,
): Promise<string> {
  const timeoutMs = opts?.timeoutMs ?? 10_000;
  const userAgent = opts?.userAgent ?? "topic-intel/1.0";
  const maxBytes = opts?.maxBytes ?? 1_500_000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": userAgent },
      redirect: "follow",
    });

    if (!res.ok) {
      throw new Error(`HTTP ${String(res.status)} for ${url}`);
    }

    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
      throw new Error(
        `Non-HTML content-type "${ct}" for ${url}`,
      );
    }

    // Stream body with maxBytes limit
    if (!res.body) {
      throw new Error(`No response body for ${url}`);
    }

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        reader.cancel().catch(() => {});
        throw new Error(
          `Response exceeds ${String(maxBytes)} bytes for ${url}`,
        );
      }
      chunks.push(value);
    }

    const decoder = new TextDecoder("utf-8", { fatal: false });
    const combined = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return decoder.decode(combined);
  } finally {
    clearTimeout(timer);
  }
}
