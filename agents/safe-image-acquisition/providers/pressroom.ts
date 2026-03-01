import crypto from "node:crypto";
import axios from "axios";
import * as cheerio from "cheerio";
import type { ImageProvider } from "../provider.js";
import type {
  ImageBrief,
  ImageCategory,
  RawImageCandidate,
  LicenseProfile,
} from "../types.js";
import { ProviderError } from "../errors.js";
import {
  normalizeDomain,
  toAbsoluteUrl,
  guessPressPaths,
} from "../url-utils.js";

const USER_AGENT = "SafeImageAcquisitionBot/1.0";
const ICON_PATTERNS = /logo|icon|sprite|favicon/i;

const EDITORIAL_TRIGGERS = [
  "editorial use only",
  "for editorial use",
  "editorial purposes only",
  "press use only",
  "for press use",
  "media use only",
  "for media use",
  "news purposes",
  "for news use",
  "not for advertising",
];

const NO_COMMERCIAL_TRIGGERS = [
  "non-commercial",
  "no commercial use",
  "not for commercial use",
  "not for promotion",
  "not for promotional use",
  "not for advertising",
];

const NO_DERIVATIVES_TRIGGERS = [
  "no modification",
  "no modifications",
  "no alteration",
  "do not alter",
  "unaltered",
  "no derivative",
  "without modification",
  "may not be modified",
  "no editing",
];

const ATTRIBUTION_TRIGGERS = [
  "credit",
  "photo credit",
  "image credit",
  "courtesy of",
  "must be credited",
  "please credit",
  "credit:",
];

const COPYRIGHT_PATTERN = /©/;

const LICENSE_LINK_KEYWORDS = [
  "terms",
  "license",
  "licensing",
  "usage",
  "media",
  "press",
  "legal",
  "permissions",
];

const CONTEXT_WINDOW = 250;
const MAX_LICENSE_TEXT = 500;

// ── Category-based default domains ────────────────────────────
//
// Env vars (comma-separated, override defaults):
//   PRESSROOM_DOMAINS_MUSIC, PRESSROOM_DOMAINS_FASHION,
//   PRESSROOM_DOMAINS_CELEBRITY, PRESSROOM_DOMAINS_ISSUE
// Fallback: PRESSROOM_DOMAINS (applied to all categories)
//
// If neither category-specific nor fallback env var is set,
// built-in defaults below are used.

const DEFAULT_DOMAINS: Record<ImageCategory, string[]> = {
  music: [
    // 4대 기획사
    "hybecorp.com",            // HYBE
    "smentertainment.com",     // SM Entertainment
    "jype.com",                // JYP Entertainment
    "yg-life.com",             // YG Entertainment (press blog)
    // 중견 기획사
    "fncent.com",              // FNC Entertainment
    "cubeent.co.kr",           // Cube Entertainment
    "starship-ent.com",        // Starship Entertainment
    // 방송·미디어
    "cjenm.com",               // CJ ENM / Mnet
  ],
  fashion: [
    "smentertainment.com",
    "hybecorp.com",
    "cjenm.com",
  ],
  celebrity: [
    "hybecorp.com",
    "smentertainment.com",
    "jype.com",
    "yg-life.com",
    "fncent.com",
    "cubeent.co.kr",
    "starship-ent.com",
    "cjenm.com",
  ],
  issue: [
    "cjenm.com",
  ],
};

function getDomains(category?: ImageCategory): string[] {
  // 1) Category-specific env var
  if (category) {
    const envKey = `PRESSROOM_DOMAINS_${category.toUpperCase()}`;
    const catRaw = process.env[envKey];
    if (catRaw) {
      return catRaw.split(",").map(normalizeDomain).filter((d) => d.length > 0);
    }
  }

  // 2) Generic fallback env var
  const fallback = process.env.PRESSROOM_DOMAINS;
  if (fallback) {
    return fallback.split(",").map(normalizeDomain).filter((d) => d.length > 0);
  }

  // 3) Built-in defaults
  const cat = category ?? "music";
  const defaults = DEFAULT_DOMAINS[cat];
  return defaults.length > 0 ? defaults : DEFAULT_DOMAINS.music;
}

function getMaxPages(): number {
  const v = process.env.PRESSROOM_MAX_PAGES;
  return v ? parseInt(v, 10) || 5 : 5;
}

function getTimeout(): number {
  const v = process.env.PRESSROOM_TIMEOUT_MS;
  return v ? parseInt(v, 10) || 12000 : 12000;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractImageUrls(
  html: string,
  pageUrl: string
): string[] {
  const $ = cheerio.load(html);
  const urls: string[] = [];

  $('meta[property="og:image"]').each((_, el) => {
    const content = $(el).attr("content");
    if (content) {
      const abs = toAbsoluteUrl(pageUrl, content);
      if (abs) urls.push(abs);
    }
  });

  $("img").each((_, el) => {
    const src =
      $(el).attr("src") ||
      $(el).attr("data-src") ||
      $(el).attr("srcset")?.split(",")[0]?.trim().split(/\s+/)[0];
    if (src) {
      const abs = toAbsoluteUrl(pageUrl, src);
      if (abs) urls.push(abs);
    }
  });

  return urls.filter((u) => !ICON_PATTERNS.test(u));
}

interface PatternMatch {
  matched: boolean;
  indices: number[];
}

function matchPatterns(text: string, patterns: string[]): PatternMatch {
  const lower = text.toLowerCase();
  const indices: number[] = [];
  for (const p of patterns) {
    const idx = lower.indexOf(p);
    if (idx !== -1) indices.push(idx);
  }
  return { matched: indices.length > 0, indices };
}

function extractContextWindows(text: string, indices: number[]): string | undefined {
  if (indices.length === 0) return undefined;

  const windows: string[] = [];
  const seen = new Set<string>();

  for (const idx of indices) {
    const start = Math.max(0, idx - CONTEXT_WINDOW);
    const end = Math.min(text.length, idx + CONTEXT_WINDOW);
    const snippet = text.slice(start, end).replace(/\s+/g, " ").trim();
    if (!seen.has(snippet)) {
      seen.add(snippet);
      windows.push(snippet);
    }
  }

  const joined = windows.join(" … ");
  return joined.length > MAX_LICENSE_TEXT
    ? joined.slice(0, MAX_LICENSE_TEXT)
    : joined;
}

function extractLicenseLink(
  $: cheerio.CheerioAPI,
  pageUrl: string
): string | undefined {
  let pageDomain: string;
  try {
    pageDomain = new URL(pageUrl).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }

  interface LinkCandidate {
    url: string;
    score: number;
  }
  const candidates: LinkCandidate[] = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const abs = toAbsoluteUrl(pageUrl, href);
    if (!abs) return;

    let linkDomain: string;
    try {
      linkDomain = new URL(abs).hostname.replace(/^www\./, "");
    } catch {
      return;
    }

    if (!linkDomain.endsWith(pageDomain) && !pageDomain.endsWith(linkDomain)) {
      return;
    }

    const lowerUrl = abs.toLowerCase();
    let score = 0;
    for (const kw of LICENSE_LINK_KEYWORDS) {
      if (lowerUrl.includes(kw)) score++;
    }
    const anchorText = $(el).text().toLowerCase();
    for (const kw of LICENSE_LINK_KEYWORDS) {
      if (anchorText.includes(kw)) score++;
    }

    if (score > 0) {
      candidates.push({ url: abs, score });
    }
  });

  if (candidates.length === 0) return undefined;

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]!.url;
}

function collectPageText($: cheerio.CheerioAPI): string {
  const parts: string[] = [];

  // Body text
  parts.push($("body").text());

  // Meta descriptions (og:description, description)
  $('meta[property="og:description"]').each((_, el) => {
    const content = $(el).attr("content");
    if (content) parts.push(content);
  });
  $('meta[name="description"]').each((_, el) => {
    const content = $(el).attr("content");
    if (content) parts.push(content);
  });

  // Image parent/sibling text (context near images)
  $("img").each((_, el) => {
    const parent = $(el).parent();
    parts.push(parent.text());
    parent.siblings().each((__, sib) => {
      parts.push($(sib).text());
    });
  });

  return parts.join(" ");
}

export class PressRoomProvider implements ImageProvider {
  readonly name = "pressroom";

  async search(brief: ImageBrief): Promise<RawImageCandidate[]> {
    const domains = getDomains(brief.category);
    const maxPages = getMaxPages();
    const timeout = getTimeout();
    const paths = guessPressPaths();
    const allCandidates: RawImageCandidate[] = [];
    const seenUrls = new Set<string>();

    for (const domain of domains) {
      const base = `https://${domain}`;
      let probed = 0;

      for (const pressPath of paths) {
        if (probed >= maxPages) break;
        probed++;

        const pageUrl = `${base}${pressPath}`;
        let html: string;
        try {
          const response = await axios.get<string>(pageUrl, {
            timeout,
            responseType: "text",
            headers: { "User-Agent": USER_AGENT },
            validateStatus: (s) => s === 200,
          });
          html = response.data;
        } catch {
          continue;
        }

        const imageUrls = extractImageUrls(html, pageUrl);

        for (const imgUrl of imageUrls) {
          if (seenUrls.has(imgUrl)) continue;
          seenUrls.add(imgUrl);

          const id = crypto
            .createHash("sha256")
            .update(imgUrl)
            .digest("hex")
            .slice(0, 16);

          allCandidates.push({
            id: `${domain}-${id}`,
            provider: "pressroom",
            previewUrl: imgUrl,
            sourceUrl: pageUrl,
            author: domain,
            width: 1200,
            height: 800,
          });
        }

        await sleep(300);
      }
    }

    return allCandidates.slice(0, 10);
  }

  async getLicenseInfo(
    candidate: RawImageCandidate
  ): Promise<LicenseProfile> {
    const timeout = getTimeout();

    let $: cheerio.CheerioAPI;
    try {
      const response = await axios.get<string>(candidate.sourceUrl, {
        timeout,
        responseType: "text",
        headers: { "User-Agent": USER_AGENT },
        validateStatus: (s) => s === 200,
      });
      $ = cheerio.load(response.data);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      throw new ProviderError(
        `Failed to fetch press page for license info: ${message}`,
        { provider: "pressroom", sourceUrl: candidate.sourceUrl }
      );
    }

    // Collect combined text: body + meta + image context
    const fullText = collectPageText($);

    // Pattern matching
    const editorialMatch = matchPatterns(fullText, EDITORIAL_TRIGGERS);
    const noCommercialMatch = matchPatterns(fullText, NO_COMMERCIAL_TRIGGERS);
    const noDerivativesMatch = matchPatterns(fullText, NO_DERIVATIVES_TRIGGERS);
    const attributionMatch = matchPatterns(fullText, ATTRIBUTION_TRIGGERS);
    const hasCopyright = COPYRIGHT_PATTERN.test(fullText);

    const editorialOnly = editorialMatch.matched;
    const noCommercial = noCommercialMatch.matched || editorialOnly;
    const noDerivatives = noDerivativesMatch.matched;
    const attributionRequired = attributionMatch.matched || hasCopyright;

    const anyTermsFound =
      editorialOnly || noCommercial || noDerivatives || attributionMatch.matched;

    // licenseUrl extraction
    const extractedLicenseUrl = extractLicenseLink($, candidate.sourceUrl);
    const licenseUrl = extractedLicenseUrl ?? candidate.sourceUrl;
    const hasDistinctLicenseUrl = extractedLicenseUrl !== undefined;

    // licenseText: context windows around matched patterns
    const allIndices = [
      ...editorialMatch.indices,
      ...noCommercialMatch.indices,
      ...noDerivativesMatch.indices,
      ...attributionMatch.indices,
    ];
    const licenseText = extractContextWindows(fullText, allIndices);

    // LicenseProfile fields
    let derivativesAllowed: boolean;
    if (noDerivatives || editorialOnly) {
      derivativesAllowed = false;
    } else {
      derivativesAllowed = true;
    }

    let allowedUses: ("commercial" | "editorial")[];
    if (editorialOnly || noCommercial) {
      allowedUses = ["editorial"];
    } else {
      allowedUses = ["commercial", "editorial"];
    }

    // Confidence scoring
    let confidence: "high" | "medium" | "low";
    if (!anyTermsFound) {
      confidence = "low";
    } else if (editorialOnly || noDerivatives || noCommercialMatch.matched) {
      confidence = "high";
    } else {
      confidence = "medium";
    }

    // Boost confidence if a distinct license URL was found
    if (hasDistinctLicenseUrl) {
      if (confidence === "low") confidence = "medium";
      else if (confidence === "medium") confidence = "high";
    }

    return {
      provider: "pressroom",
      sourceUrl: candidate.sourceUrl,
      licenseUrl,
      licenseText,

      allowedUses,
      allowedChannels: "any",
      territory: "worldwide",

      derivatives: {
        allowed: derivativesAllowed,
        allowedTransforms: derivativesAllowed ? "any" : undefined,
      },

      attribution: {
        required: attributionRequired,
        textTemplate: attributionRequired
          ? `Courtesy of ${candidate.author ?? "Unknown"}`
          : undefined,
      },

      modelRelease: "unknown",
      propertyRelease: "unknown",

      restrictions: {
        editorialOnly,
        noDerivatives,
        noCommercial,
      },

      confidence,
    };
  }

  async fetchAsset(
    candidate: RawImageCandidate
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const timeout = getTimeout();

    let imageBuffer: ArrayBuffer;
    let contentType: string;
    try {
      const response = await axios.get<ArrayBuffer>(candidate.previewUrl, {
        timeout,
        responseType: "arraybuffer",
        headers: { "User-Agent": USER_AGENT },
      });
      imageBuffer = response.data;
      const ct = response.headers["content-type"];
      contentType =
        typeof ct === "string" && ct.startsWith("image/")
          ? ct.split(";")[0]!
          : "image/jpeg";
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      throw new ProviderError(
        `PressRoom image download failed: ${message}`,
        { provider: "pressroom", imageUrl: candidate.previewUrl }
      );
    }

    return {
      buffer: Buffer.from(imageBuffer),
      mimeType: contentType,
    };
  }
}
