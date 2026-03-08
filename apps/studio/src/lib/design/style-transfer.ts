/**
 * Style Transfer Agent — extracts StyleToken from reference images.
 *
 * Uses GPT-4o Vision to analyze album art, moodboards, or any reference image
 * and produce a structured StyleToken that can be used by Design Director
 * and Visual Designer to maintain visual consistency.
 */

import { z } from "zod";
import { callGptVision } from "../llm";
import type { StyleToken, TypographyMood } from "./types";

// ── Zod schema for Vision API response ──────────────

const styleTokenResponseSchema = z.object({
  name: z.string(),
  colors: z.object({
    palette: z.array(z.string()).min(2).max(8),
    ratios: z.array(z.number()),
    gradient: z.string().optional(),
  }),
  typography: z.object({
    mood: z.enum(["serif_classic", "sans_modern", "display_impact", "handwritten"]),
    weight: z.enum(["light", "regular", "bold", "black"]),
    style: z.enum(["serif", "sans", "display", "mono"]),
  }),
  layout: z.object({
    density: z.enum(["sparse", "balanced", "dense"]),
    alignment: z.enum(["center", "left", "asymmetric"]),
    whitespace: z.enum(["generous", "moderate", "tight"]),
  }),
  effects: z.array(z.string()),
  moodKeywords: z.array(z.string()).min(2).max(8),
});

// ── Options ─────────────────────────────────────────

export interface StyleTransferOptions {
  model?: string;
  detail?: "low" | "high";
  contextHint?: string; // e.g. "K-POP album cover", "indie rock aesthetic"
}

// ── Main function ───────────────────────────────────

/**
 * Extract a StyleToken from a reference image (album art, moodboard, etc.)
 *
 * @param imageBase64 - Base64-encoded image (with or without data: prefix)
 * @param opts - Optional configuration
 * @returns Extracted StyleToken
 */
export async function extractStyleToken(
  imageBase64: string,
  opts?: StyleTransferOptions,
): Promise<StyleToken> {
  const contextLine = opts?.contextHint
    ? `\nContext: This image is ${opts.contextHint}.`
    : "";

  const prompt = `You are a Visual Design Analyst for a Korean music/culture web magazine.

Analyze the provided image and extract a comprehensive style token that captures its visual identity.
${contextLine}

## What to Extract

1. **Colors**: Extract the dominant color palette (2-8 hex colors) with approximate usage ratios (sum to 1.0). If there's a clear gradient, provide a CSS linear-gradient expression.

2. **Typography Mood**: Based on the image's overall feel, select the best matching typography mood:
   - "serif_classic": Refined, classic (ballad, orchestral, mature concepts)
   - "sans_modern": Clean, contemporary (K-pop mainstream, sleek concepts, magazine)
   - "display_impact": Strong, attention-grabbing (hip-hop, rock, bold concepts)
   - "handwritten": Personal, organic (indie, acoustic, intimate concepts)

3. **Typography Weight/Style**: Infer from the image's mood and any visible text.

4. **Layout**: Assess visual density, alignment tendency, and whitespace usage.

5. **Effects**: List visual effects seen or implied (e.g., "gradient", "blur_bg", "neon_glow", "grain", "halftone", "duotone", "vignette", "shadow", "metallic", "holographic").

6. **Mood Keywords**: 3-6 English keywords capturing the overall mood (e.g., "futuristic", "nostalgic", "dark", "vibrant", "dreamy").

## Response Format (JSON)
{
  "name": "<short descriptive name, e.g. 'Neon Retro Purple'>",
  "colors": {
    "palette": ["#hex1", "#hex2", ...],
    "ratios": [0.4, 0.3, ...],
    "gradient": "linear-gradient(...)" // optional
  },
  "typography": {
    "mood": "<mood>",
    "weight": "light" | "regular" | "bold" | "black",
    "style": "serif" | "sans" | "display" | "mono"
  },
  "layout": {
    "density": "sparse" | "balanced" | "dense",
    "alignment": "center" | "left" | "asymmetric",
    "whitespace": "generous" | "moderate" | "tight"
  },
  "effects": ["effect1", "effect2"],
  "moodKeywords": ["keyword1", "keyword2", ...]
}`;

  const result = await callGptVision<z.infer<typeof styleTokenResponseSchema>>(
    prompt,
    [{ base64: imageBase64, detail: opts?.detail ?? "low" }],
    {
      model: opts?.model ?? "gpt-4o",
      schema: styleTokenResponseSchema,
    },
  );

  // Normalize ratios to sum to 1
  const ratioSum = result.colors.ratios.reduce((s, r) => s + r, 0);
  const normalizedRatios = ratioSum > 0
    ? result.colors.ratios.map((r) => Math.round((r / ratioSum) * 100) / 100)
    : result.colors.palette.map(() => 1 / result.colors.palette.length);

  // Ensure palette and ratios have same length
  while (normalizedRatios.length < result.colors.palette.length) {
    normalizedRatios.push(0);
  }

  const token: StyleToken = {
    id: `style_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: result.name,
    colors: {
      palette: result.colors.palette,
      ratios: normalizedRatios,
      gradient: result.colors.gradient,
    },
    typography: result.typography,
    layout: result.layout,
    effects: result.effects,
    moodKeywords: result.moodKeywords,
  };

  return token;
}

/**
 * Extract style from a URL (downloads the image first).
 */
export async function extractStyleFromUrl(
  imageUrl: string,
  opts?: StyleTransferOptions,
): Promise<StyleToken> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${imageUrl}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const base64 = buffer.toString("base64");
  const mimeType = response.headers.get("content-type") ?? "image/jpeg";
  const dataUri = `data:${mimeType};base64,${base64}`;

  const token = await extractStyleToken(dataUri, opts);
  token.sourceImageUrl = imageUrl;
  return token;
}

/**
 * Merge a StyleToken's colors into a BrandKit-compatible color override.
 * Useful for passing extracted style to the visual designer.
 */
export function styleTokenToColorOverrides(token: StyleToken): {
  primary: string;
  accent: string;
  gradients: string[];
} {
  const palette = token.colors.palette;
  return {
    primary: palette[0] ?? "#6C5CE7",
    accent: palette[1] ?? "#E17055",
    gradients: token.colors.gradient
      ? [token.colors.gradient]
      : palette.length >= 2
        ? [`linear-gradient(135deg, ${palette[0]}, ${palette[1]})`]
        : [],
  };
}
