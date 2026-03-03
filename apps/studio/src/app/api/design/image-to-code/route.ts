import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  renderHtmlToDataUri,
  measureOpacityRatio,
  warmUp,
} from "@/lib/studio/designEditor/inlineRenderer";
import type { FontMood } from "@/lib/studio/designEditor/inlineRenderer";

// ── Constants ────────────────────────────────────────────
const MAX_TOKENS = 8192;
const TIMEOUT_MS = 60_000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

type ImageMediaType = "image/png" | "image/jpeg" | "image/gif" | "image/webp";

const MODEL = "gpt-4o";

// ── System Prompt ────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert frontend developer specializing in Satori-compatible HTML rendering.
You have perfect vision and pay extreme attention to detail — colors, spacing, typography, and layout.

Your task: Convert the given screenshot into a single root HTML <div> that renders identically when processed by the Satori SVG renderer.

## CANVAS
- Root element MUST be: <div style="position:relative;width:1080px;height:1350px;display:flex;flex-direction:column;overflow:hidden; ...your background styles...">
- This is an Instagram card news slide: 1080 x 1350 px

## SATORI COMPATIBILITY (STRICT — violations cause render failure)
1. ALL styles MUST be inline: style="property:value; ..."
2. NO <style> tags, NO class attributes, NO id attributes
3. Every <div> that contains child elements MUST have display:flex (or display:contents or display:none)
4. flex-direction defaults to "row" in Satori — explicitly set flex-direction:column where needed
5. FORBIDDEN CSS properties (will crash or be ignored): text-shadow, box-shadow, object-fit, object-position, filter, backdrop-filter, -webkit-*, -moz-*, background-blend-mode, text-overflow, aspect-ratio
6. NO pseudo-elements (::before, ::after)
7. NO SVG filters (feGaussianBlur, feDropShadow, feMerge, etc.)
8. For image placeholders, use a colored <div> with matching background color and dimensions instead of <img>
9. ALL dimensions MUST be in px (NO %, em, rem, vh, vw, calc())
10. For border-radius, use px values
11. For overlapping elements, use position:absolute with top/left in px
12. For text truncation, do NOT use text-overflow:ellipsis — just limit text content

## AVAILABLE FONTS (use ONLY these)
- "Pretendard", sans-serif (weights: 400, 600, 700, 800) — clean sans-serif, Korean
- "Noto Sans KR", sans-serif (weights: 400, 700) — clean sans, Korean
- "Noto Serif KR", serif (weights: 400, 700) — editorial serif, Korean
- "Black Han Sans", sans-serif (weight: 400) — heavy impact display, Korean
Choose the font family that best matches the screenshot's typography style.

## ACCURACY REQUIREMENTS (from screenshot-to-code best practices)
- Match ALL colors exactly using #RRGGBB hex codes or rgba()
- Match font sizes (px), font weights (400/600/700/800), and letter-spacing precisely
- Reproduce ALL visible text content exactly as shown in the image
- Match element positions, padding, margins (all in px)
- Reproduce background gradients with correct angles and color stops: linear-gradient(Ndeg, #color1 0%, #color2 100%)
- For solid color backgrounds, use background:#RRGGBB
- For overlays/scrims, use a positioned div with background:rgba(R,G,B,A)
- Do NOT add placeholder comments like "<!-- more content here -->" — write the COMPLETE code
- Do NOT be lazy — reproduce EVERY visible element

## OUTPUT FORMAT
Return ONLY the HTML starting with <div and ending with </div>.
No markdown code fences. No explanation. No comments in the code.
Just pure, complete HTML that Satori can render.`;

const USER_PROMPT = "이 이미지를 Satori-compatible HTML로 변환해주세요. 레이아웃, 색상, 타이포그래피, 텍스트 내용을 최대한 정확히 재현하세요.";

// ── Decompose System Prompt ─────────────────────────────

const DECOMPOSE_SYSTEM_PROMPT = `You are an expert frontend developer specializing in Satori-compatible HTML rendering.
You have perfect vision and pay extreme attention to detail.

Your task: Analyze the given screenshot and SEPARATE it into two layers:
1. HERO LAYER — The base photograph or key visual image (if one exists)
2. OVERLAY LAYER — All design elements ABOVE the photo: text, logos, shapes, gradients, scrims, decorative elements

## CLASSIFICATION CRITERIA (follow strictly)
Determine: Does this design contain a real **photograph** beneath design elements?

Set hasHeroImage: **true** ONLY when:
- There is a clearly recognizable photograph (person, place, object, scene) underneath text/graphic overlays
- The photo occupies a significant portion of the canvas (≥30%)
- Removing the photo would leave the design incomplete — the photo IS the visual content

Set hasHeroImage: **false** when:
- The background is a solid color, gradient, or abstract pattern
- The design is entirely typographic or illustrative (no photograph)
- There are small decorative images (icons, logos) but no dominant photo
- Ambiguous cases: textured backgrounds, blurred color fields, abstract art

## CANVAS
- Root element: <div style="position:relative;width:1080px;height:1350px;display:flex;flex-direction:column;overflow:hidden;background:transparent;">
- Instagram card news: 1080 x 1350 px

## WHEN hasHeroImage is TRUE (overlay-only):
- Root div background MUST be: background:transparent
- Do NOT recreate the photograph in any way — no <img> tags, no colored divs mimicking the photo
- Generate ONLY overlay elements: text blocks, logos, gradient scrims, decorative shapes, semi-transparent color overlays
- Scrim/gradient overlays for text readability MUST be included (e.g. linear-gradient from transparent to rgba(0,0,0,0.6))
- All overlay elements should use position:absolute with top/left in px
- heroRegion: bounding box of the photo area ({top, left, width, height} in px)

## WHEN hasHeroImage is FALSE (full mode):
- Generate the complete design including backgrounds, gradients, all elements
- overlayHtml field contains the COMPLETE HTML (no separation needed)

## SATORI COMPATIBILITY (STRICT)
1. ALL styles inline: style="property:value; ..."
2. NO <style> tags, NO class, NO id attributes
3. Every <div> with children MUST have display:flex (or display:contents or display:none)
4. Set flex-direction:column explicitly where needed
5. FORBIDDEN CSS: text-shadow, box-shadow, object-fit, object-position, filter, backdrop-filter, -webkit-*, -moz-*, background-blend-mode, text-overflow, aspect-ratio
6. NO pseudo-elements, NO SVG filters
7. ALL dimensions in px only (NO %, em, rem, vh, vw, calc())
8. Overlapping elements: position:absolute with top/left in px

## AVAILABLE FONTS (ONLY these)
- "Pretendard", sans-serif (weights: 400, 600, 700, 800)
- "Noto Sans KR", sans-serif (weights: 400, 700)
- "Noto Serif KR", serif (weights: 400, 700)
- "Black Han Sans", sans-serif (weight: 400)

## ACCURACY
- Match ALL colors exactly (#RRGGBB or rgba())
- Match font sizes, weights, letter-spacing precisely
- Reproduce ALL visible text content exactly
- Match positions, padding, margins (all px)
- Reproduce gradients with correct angles and stops
- Do NOT be lazy — reproduce EVERY visible overlay element

## OUTPUT FORMAT
Return a JSON object (no markdown fences, no explanation):
{
  "hasHeroImage": true or false,
  "confidence": 0.0 to 1.0 (how confident you are in the hasHeroImage decision),
  "reasoning": "Brief explanation of why this is/isn't a photo-based design (1-2 sentences)",
  "heroRegion": { "top": 0, "left": 0, "width": 1080, "height": 1350 } or null,
  "fontMood": "bold-display" or "clean-sans" or "editorial" or "impact" or "minimal",
  "overlayHtml": "<div style=\\"position:relative;width:1080px;height:1350px;display:flex;flex-direction:column;overflow:hidden;background:transparent;\\">...overlay elements...</div>"
}

Return ONLY valid JSON.`;

const DECOMPOSE_USER_PROMPT = "이 이미지를 분석하여 배경 사진(hero)과 디자인 오버레이를 분리해주세요. JSON 형식으로 응답하세요.";

// ── Decompose types & helpers ───────────────────────────

interface HeroRegion {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface DecomposeResult {
  hasHeroImage: boolean;
  heroRegion: HeroRegion | null;
  confidence: number; // 0-1, 판단 신뢰도
  reasoning: string;  // 분리 판단 근거
  fontMood: string;
  overlayHtml: string;
}

/** JSON 텍스트에서 DecomposeResult를 추출하고 필수 필드를 검증한다 */
function extractDecomposeResult(text: string): DecomposeResult {
  const trimmed = text.trim();

  let raw: Record<string, unknown> | null = null;

  // 1) 직접 파싱
  try { raw = JSON.parse(trimmed); } catch { /* fall through */ }

  // 2) 코드 펜스 내부
  if (!raw) {
    const fenceMatch = /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/.exec(trimmed);
    if (fenceMatch?.[1]) {
      try { raw = JSON.parse(fenceMatch[1].trim()); } catch { /* fall through */ }
    }
  }

  // 3) 첫 번째 { ... } 블록
  if (!raw) {
    const jsonMatch = /\{[\s\S]*\}/.exec(trimmed);
    if (jsonMatch) {
      try { raw = JSON.parse(jsonMatch[0]); } catch { /* fall through */ }
    }
  }

  if (!raw || typeof raw !== "object") {
    throw new Error("Could not parse decompose result as JSON");
  }

  // ── 필수 필드 검증 ─────────────────────────────────
  const hasHeroImage = typeof raw.hasHeroImage === "boolean" ? raw.hasHeroImage : false;
  const overlayHtml = typeof raw.overlayHtml === "string" ? raw.overlayHtml : "";
  const fontMood = typeof raw.fontMood === "string" ? raw.fontMood : "bold-display";
  const confidence = typeof raw.confidence === "number" ? Math.min(1, Math.max(0, raw.confidence)) : 0.5;
  const reasoning = typeof raw.reasoning === "string" ? raw.reasoning : "";

  if (!overlayHtml || !overlayHtml.includes("<div")) {
    throw new Error("overlayHtml is missing or invalid");
  }

  // heroRegion 검증
  let heroRegion: HeroRegion | null = null;
  if (raw.heroRegion && typeof raw.heroRegion === "object") {
    const hr = raw.heroRegion as Record<string, unknown>;
    if (
      typeof hr.top === "number" && typeof hr.left === "number" &&
      typeof hr.width === "number" && typeof hr.height === "number"
    ) {
      heroRegion = { top: hr.top, left: hr.left, width: hr.width, height: hr.height };
    }
  }

  return { hasHeroImage, heroRegion, confidence, reasoning, fontMood, overlayHtml };
}

/**
 * hasHeroImage=true 인 오버레이 HTML을 후처리한다.
 * - 오버레이에 섞여 들어온 <img> 태그 제거 (사진 재현 방지)
 * - 루트 div의 background가 transparent가 아니면 강제 교체
 * - 큰 영역을 차지하는 불투명 배경색 div 제거 (사진을 컬러로 재현한 경우)
 */
function sanitizeOverlayHtml(html: string): string {
  // <img> 태그 제거 (오버레이에 사진이 포함되면 안됨)
  let result = html.replace(/<img\s[^>]*\/?>/gi, "");

  // 루트 div background → transparent 강제
  const rootStyleMatch = /^(<div\s+style=")([^"]*)(")/i.exec(result);
  if (rootStyleMatch) {
    let style = rootStyleMatch[2]!;
    // background 속성을 transparent로 교체
    if (/background\s*:[^;]+/i.test(style)) {
      style = style.replace(/background\s*:[^;]+;?/gi, "background:transparent;");
    } else {
      style = `background:transparent;${style}`;
    }
    result = `${rootStyleMatch[1]}${style}${rootStyleMatch[3]}${result.slice(rootStyleMatch[0].length)}`;
  }

  return result;
}

/** 오버레이 HTML에 hero 이미지를 합성한다 */
function composeHtml(
  overlayHtml: string,
  heroDataUri: string,
  heroRegion: HeroRegion | null,
): string {
  const r = heroRegion ?? { top: 0, left: 0, width: 1080, height: 1350 };
  const heroImg = `<img src="${heroDataUri}" style="position:absolute;top:${r.top}px;left:${r.left}px;width:${r.width}px;height:${r.height}px;display:block;" />`;

  // 루트 <div ...> 태그의 닫는 > 를 정확히 찾아서 그 직후에 삽입
  const rootTagMatch = /^<div\s+[^>]*>/.exec(overlayHtml);
  if (!rootTagMatch) return overlayHtml;
  const insertPos = rootTagMatch[0].length;
  return overlayHtml.slice(0, insertPos) + heroImg + overlayHtml.slice(insertPos);
}

// ── Warm-up ──────────────────────────────────────────────
warmUp();

// ── Post-processor ───────────────────────────────────────

function sanitizeForSatori(raw: string): string {
  let html = raw.trim();

  // Strip markdown code fences
  html = html.replace(/^```(?:html|jsx|tsx)?\s*\n?/m, "").replace(/\n?\s*```\s*$/m, "");
  html = html.trim();

  // Strip HTML comments
  html = html.replace(/<!--[\s\S]*?-->/g, "");

  // Strip class and id attributes
  html = html.replace(/\s+class="[^"]*"/gi, "");
  html = html.replace(/\s+id="[^"]*"/gi, "");

  // Remove unsupported CSS properties from inline styles
  const UNSUPPORTED_PROPS = [
    /text-shadow\s*:[^;]+;?/gi,
    /box-shadow\s*:[^;]+;?/gi,
    /object-fit\s*:[^;]+;?/gi,
    /object-position\s*:[^;]+;?/gi,
    /filter\s*:[^;]+;?/gi,
    /backdrop-filter\s*:[^;]+;?/gi,
    /-webkit-[^:]+\s*:[^;]+;?/gi,
    /-moz-[^:]+\s*:[^;]+;?/gi,
    /background-blend-mode\s*:[^;]+;?/gi,
    /text-overflow\s*:[^;]+;?/gi,
    /aspect-ratio\s*:[^;]+;?/gi,
  ];
  for (const re of UNSUPPORTED_PROPS) {
    html = html.replace(re, "");
  }

  // Ensure root div has correct canvas dimensions
  const rootMatch = /^(<div\s+style=")([^"]*)(")/i.exec(html);
  if (rootMatch) {
    let style = rootMatch[2]!;
    if (!style.includes("width:1080") && !style.includes("width: 1080")) {
      style = `width:1080px;height:1350px;${style}`;
    }
    if (!style.includes("display:flex") && !style.includes("display: flex")) {
      style = `display:flex;flex-direction:column;${style}`;
    }
    html = `${rootMatch[1]}${style}${rootMatch[3]}${html.slice(rootMatch[0].length)}`;
  }

  // Clean up style artifacts
  html = html.replace(/;{2,}/g, ";");
  html = html.replace(/;\s*"/g, '"');
  html = html.replace(/style="\s*;/g, 'style="');

  return html.trim();
}

function detectFontMood(html: string): FontMood {
  const lower = html.toLowerCase();
  if (lower.includes("noto serif kr")) return "editorial";
  if (lower.includes("black han sans")) return "impact";
  if (lower.includes("noto sans kr")) return "clean-sans";
  return "bold-display";
}

function mimeFromFile(file: File): ImageMediaType {
  const t = file.type.toLowerCase();
  if (t.includes("png")) return "image/png";
  if (t.includes("gif")) return "image/gif";
  if (t.includes("webp")) return "image/webp";
  return "image/jpeg";
}

function extractHtml(text: string): string {
  const trimmed = text.trim();
  const divStart = trimmed.indexOf("<div");
  if (divStart >= 0) return trimmed.slice(divStart);
  const fenceMatch = /```(?:html|jsx)?\s*\n?([\s\S]*?)\n?\s*```/.exec(trimmed);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();
  return trimmed;
}

// ── Vision API caller ────────────────────────────────────

async function callVisionAPI(
  base64Data: string,
  mime: ImageMediaType,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const client = new OpenAI({ apiKey });
  const dataUri = `data:${mime};base64,${base64Data}`;

  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    temperature: 0.2,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: dataUri, detail: "high" } },
          { type: "text", text: userPrompt },
        ],
      },
    ],
  });

  return response.choices[0]?.message?.content ?? "";
}

// ── Route Handler ────────────────────────────────────────

export async function POST(req: Request) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 },
    );
  }

  // Provider is always OpenAI
  const provider = "openai";

  // Extract image file
  const imageFile = formData.get("image");
  if (!(imageFile instanceof File)) {
    return NextResponse.json(
      { error: "Missing 'image' file in form data" },
      { status: 400 },
    );
  }

  if (imageFile.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: `Image too large (max ${MAX_IMAGE_BYTES / 1024 / 1024}MB)` },
      { status: 400 },
    );
  }

  const start = performance.now();

  // Convert image to base64
  const buffer = Buffer.from(await imageFile.arrayBuffer());
  const base64Data = buffer.toString("base64");
  const mime = mimeFromFile(imageFile);

  // Parse mode (default: decompose)
  const modeRaw = formData.get("mode");
  const mode = typeof modeRaw === "string" && modeRaw === "full" ? "full" : "decompose";

  // Parse manual hero region (user-specified via drag selection)
  let manualHeroRegion: HeroRegion | null = null;
  const manualRegionRaw = formData.get("manualHeroRegion");
  if (typeof manualRegionRaw === "string") {
    try {
      const parsed = JSON.parse(manualRegionRaw) as Record<string, unknown>;
      if (
        typeof parsed.top === "number" && typeof parsed.left === "number" &&
        typeof parsed.width === "number" && typeof parsed.height === "number"
      ) {
        manualHeroRegion = {
          top: parsed.top, left: parsed.left,
          width: parsed.width, height: parsed.height,
        };
      }
    } catch { /* ignore invalid JSON */ }
  }

  const sysPrompt = mode === "decompose" ? DECOMPOSE_SYSTEM_PROMPT : SYSTEM_PROMPT;
  // 수동 영역이 지정된 경우: GPT에게 사진 위치를 알려주고 오버레이만 생성하라고 지시
  const usrPrompt = manualHeroRegion
    ? `이 이미지에서 배경 사진은 top:${String(manualHeroRegion.top)}px, left:${String(manualHeroRegion.left)}px, ` +
      `width:${String(manualHeroRegion.width)}px, height:${String(manualHeroRegion.height)}px 영역에 있습니다. ` +
      `hasHeroImage를 true로 설정하고, 이 사진 위의 디자인 오버레이 요소(텍스트, 로고, 스크림, 장식)만 HTML로 생성하세요. ` +
      `사진 자체를 코드로 재현하지 마세요. JSON 형식으로 응답하세요.`
    : (mode === "decompose" ? DECOMPOSE_USER_PROMPT : USER_PROMPT);

  // Call OpenAI Vision API
  let rawText: string;
  try {
    rawText = await callVisionAPI(base64Data, mime, sysPrompt, usrPrompt);

    if (!rawText) {
      return NextResponse.json(
        { error: "Empty response from Vision API" },
        { status: 502 },
      );
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return NextResponse.json(
        { error: "Vision API request timed out (60s)" },
        { status: 504 },
      );
    }
    const msg = err instanceof Error ? err.message : String(err);

    if (msg.includes("not configured")) {
      return NextResponse.json({ error: msg }, { status: 500 });
    }
    if (msg.includes("429") || msg.includes("rate")) {
      return NextResponse.json(
        { error: "Rate limited — please retry in a few seconds", details: msg },
        { status: 429 },
      );
    }

    return NextResponse.json(
      { error: "Vision API call failed", details: msg },
      { status: 502 },
    );
  }

  // ── Decompose mode ──────────────────────────────────────
  if (mode === "decompose") {
    let decompose: DecomposeResult;
    let usedFallback = false;

    try {
      decompose = extractDecomposeResult(rawText);
    } catch {
      // Fallback: treat as full-mode HTML
      usedFallback = true;
      const rawHtml = extractHtml(rawText);
      decompose = {
        hasHeroImage: false,
        heroRegion: null,
        confidence: 0,
        reasoning: "JSON parse failed — falling back to full mode",
        fontMood: "bold-display",
        overlayHtml: rawHtml,
      };
    }

    // 수동 영역이 지정된 경우: GPT 판단을 무시하고 사용자 지정 영역 사용
    if (manualHeroRegion) {
      decompose.hasHeroImage = true;
      decompose.heroRegion = manualHeroRegion;
      decompose.confidence = 1;
      decompose.reasoning = "사용자가 수동으로 사진 영역을 지정함";
    }

    // confidence가 낮으면 (< 0.4) hasHeroImage 판단을 신뢰하지 않고 full 모드로 처리
    if (!manualHeroRegion && decompose.hasHeroImage && decompose.confidence < 0.4) {
      decompose.hasHeroImage = false;
      decompose.heroRegion = null;
    }

    // Satori 호환 sanitize
    let overlayHtml = sanitizeForSatori(decompose.overlayHtml);

    // hasHeroImage인 경우 오버레이 전용 후처리 (img 제거, background:transparent 강제)
    if (decompose.hasHeroImage) {
      overlayHtml = sanitizeOverlayHtml(overlayHtml);
    }

    const fontMood: FontMood = (
      ["bold-display", "clean-sans", "editorial", "impact", "minimal", "playful"] as const
    ).includes(decompose.fontMood as FontMood)
      ? (decompose.fontMood as FontMood)
      : detectFontMood(overlayHtml);

    // ── 렌더 기반 불투명도 검증 ─────────────────────────
    // 오버레이만 렌더해서 실제 투명도를 측정한다.
    // 불투명 비율이 75% 이상이면 GPT가 배경을 재현한 것으로 판단.
    // 수동 영역 지정 시에는 무효화하지 않고 경고만 반환.
    let opacityRatio: number | null = null;
    if (decompose.hasHeroImage) {
      try {
        opacityRatio = await measureOpacityRatio(overlayHtml, fontMood);
        if (opacityRatio > 0.75 && !manualHeroRegion) {
          // 자동 모드: 오버레이가 너무 불투명 → 배경이 재현된 것으로 판단
          decompose.hasHeroImage = false;
          decompose.heroRegion = null;
        }
        // 수동 모드에서 불투명도가 높으면 opacityRatio로 클라이언트에 경고 전달
      } catch {
        // 측정 실패는 무시하고 계속 진행
      }
    }

    // Compose: inject hero image into overlay HTML (미리보기용)
    const heroDataUri = `data:${mime};base64,${base64Data}`;
    const composedHtml = decompose.hasHeroImage
      ? composeHtml(overlayHtml, heroDataUri, decompose.heroRegion)
      : overlayHtml;

    // Render preview from composed HTML
    let preview: string | null = null;
    let renderError: string | null = null;
    try {
      preview = await renderHtmlToDataUri(composedHtml, fontMood);
    } catch (err) {
      renderError = err instanceof Error ? err.message : String(err);
    }

    const elapsed = Math.round(performance.now() - start);

    return NextResponse.json({
      html: composedHtml,
      fontMood,
      provider,
      model: MODEL,
      preview,
      renderTimeMs: elapsed,
      mode: "decompose",
      hasHeroImage: decompose.hasHeroImage,
      confidence: decompose.confidence,
      reasoning: decompose.reasoning,
      ...(opacityRatio !== null ? { opacityRatio: Math.round(opacityRatio * 100) } : {}),
      ...(decompose.hasHeroImage ? { overlayHtml } : {}),
      ...(decompose.heroRegion ? { heroRegion: decompose.heroRegion } : {}),
      ...(renderError ? { renderError } : {}),
      ...(usedFallback ? { fallback: true } : {}),
    });
  }

  // ── Full mode (existing behavior) ───────────────────────
  const rawHtml = extractHtml(rawText);
  const html = sanitizeForSatori(rawHtml);
  const fontMood = detectFontMood(html);

  let preview: string | null = null;
  let renderError: string | null = null;
  try {
    preview = await renderHtmlToDataUri(html, fontMood);
  } catch (err) {
    renderError = err instanceof Error ? err.message : String(err);
  }

  const elapsed = Math.round(performance.now() - start);

  return NextResponse.json({
    html,
    fontMood,
    provider,
    model: MODEL,
    preview,
    renderTimeMs: elapsed,
    mode: "full",
    hasHeroImage: false,
    ...(renderError ? { renderError } : {}),
  });
}
