// ============================================================================
// JSON extraction & parsing utilities for LLM responses
// ============================================================================

/**
 * Strip markdown code fences (```json ... ``` or ``` ... ```).
 */
function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = /^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/s.exec(trimmed);
  if (fenceMatch?.[1] !== undefined) {
    return fenceMatch[1].trim();
  }
  return trimmed;
}

/**
 * Extract a JSON object from raw LLM text.
 *
 * Strategy (in order):
 * 1. Strip markdown code fences if present.
 * 2. If trimmed text starts with "{" and ends with "}", return as-is.
 * 3. Otherwise find the first "{" and last "}" and extract that substring.
 * 4. If no "{" found, throw.
 */
export function extractJSONObject(text: string): string {
  const stripped = stripCodeFence(text);

  // Fast path: already a clean JSON object
  if (stripped.startsWith("{") && stripped.endsWith("}")) {
    return stripped;
  }

  // Find first "{" and last "}"
  const firstBrace = stripped.indexOf("{");
  const lastBrace = stripped.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    const preview = stripped.slice(0, 120);
    throw new Error(
      `Cannot extract JSON object from text. No valid { ... } found.\nPreview: ${preview}`,
    );
  }

  return stripped.slice(firstBrace, lastBrace + 1);
}

/**
 * Safely parse a JSON string. Throws with a useful error message on failure.
 */
export function safeJsonParse<T = unknown>(jsonText: string): T {
  try {
    return JSON.parse(jsonText) as T;
  } catch (err: unknown) {
    const preview = jsonText.slice(0, 200);
    const message =
      err instanceof Error ? err.message : "Unknown parse error";
    throw new Error(
      `JSON parse failed: ${message}\nInput preview: ${preview}`,
    );
  }
}
