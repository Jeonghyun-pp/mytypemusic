import fs from "node:fs/promises";
import path from "node:path";
import { StyleProfileSchema, type StyleProfile } from "./schema.js";
import { buildStyleAnalysisSystemPrompt, buildStyleAnalysisUserPrompt } from "./vision-prompt.js";

// ============================================================================
// analyzeReferenceImages — OpenAI Vision style extraction
// ============================================================================

const DEFAULT_MODEL = "gpt-4o";
const DEFAULT_TIMEOUT_MS = 60_000;

type ImageMediaType = "image/png" | "image/jpeg" | "image/gif" | "image/webp";

/**
 * Analyze 1-3 reference images using OpenAI Vision and extract a StyleProfile.
 *
 * @param imagePaths - Array of absolute paths to reference images (1-3)
 * @param outDir - Directory to save style-profile.json
 * @returns StyleProfile
 */
export async function analyzeReferenceImages(params: {
  imagePaths: string[];
  outDir: string;
}): Promise<StyleProfile> {
  const { imagePaths, outDir } = params;

  if (imagePaths.length === 0) {
    throw new Error("At least one reference image is required");
  }
  if (imagePaths.length > 3) {
    throw new Error("Maximum 3 reference images allowed");
  }

  const apiKey = requireEnv("OPENAI_API_KEY");
  const baseUrl = process.env["OPENAI_BASE_URL"] ?? "https://api.openai.com/v1";
  const model = process.env["STYLE_ANALYSIS_MODEL"] ?? DEFAULT_MODEL;

  // Build image content blocks for OpenAI Vision
  const contentBlocks: Array<
    | { type: "image_url"; image_url: { url: string; detail: "high" } }
    | { type: "text"; text: string }
  > = [];

  for (const imgPath of imagePaths) {
    const absPath = path.resolve(imgPath);
    const data = await fs.readFile(absPath);
    const base64 = data.toString("base64");
    const ext = path.extname(absPath).toLowerCase();
    const mediaType = extToMediaType(ext);

    contentBlocks.push({
      type: "image_url",
      image_url: {
        url: `data:${mediaType};base64,${base64}`,
        detail: "high",
      },
    });
  }

  // Add text instruction after images
  contentBlocks.push({
    type: "text",
    text: buildStyleAnalysisUserPrompt(imagePaths.length),
  });

  const systemPrompt = buildStyleAnalysisSystemPrompt() +
    "\n\nIMPORTANT: You MUST respond with ONLY a valid JSON object. No markdown, no explanation — just raw JSON.";

  // Call OpenAI Vision API
  const body = {
    model,
    max_tokens: 2048,
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: contentBlocks },
    ],
  };

  const response = await callWithTimeout(apiKey, baseUrl, body, DEFAULT_TIMEOUT_MS);

  const rawText = response.choices[0]?.message.content ?? "";
  const jsonText = extractJSON(rawText);
  const parsed = JSON.parse(jsonText) as Record<string, unknown>;

  // Add metadata
  const profileId = `style_${Date.now().toString(36)}`;
  const fullProfile = {
    ...parsed,
    profileId,
    referenceImagePaths: imagePaths,
  };

  // Validate
  const profile = StyleProfileSchema.parse(fullProfile);

  // Save
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "style-profile.json");
  await fs.writeFile(outPath, JSON.stringify(profile, null, 2), "utf-8");

  console.log(`[style-analysis] Profile saved: ${outPath} (confidence: ${profile.confidence})`);
  return profile;
}

// ── Helpers ──────────────────────────────────────────────────

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function extToMediaType(ext: string): ImageMediaType {
  switch (ext) {
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".gif": return "image/gif";
    case ".webp": return "image/webp";
    default: return "image/jpeg";
  }
}

function extractJSON(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return trimmed;
  const fenceMatch = /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/.exec(trimmed);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();
  return trimmed;
}

type OpenAIResponse = {
  choices: Array<{ message: { content: string | null } }>;
};

async function callWithTimeout(
  apiKey: string,
  baseUrl: string,
  body: unknown,
  timeoutMs: number,
): Promise<OpenAIResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`OpenAI Vision API error ${res.status}: ${text}`);
    }

    return (await res.json()) as OpenAIResponse;
  } finally {
    clearTimeout(timer);
  }
}
