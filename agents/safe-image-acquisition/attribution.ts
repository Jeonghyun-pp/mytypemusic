import type {
  ValidatedAsset,
  PostChannel,
  AttributionLine,
  AttributionBundle,
} from "./types.js";

const MAX_LINE_LENGTH = 120;

function domainFromUrl(sourceUrl: string): string | undefined {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + "\u2026" : text;
}

function buildCreditText(asset: ValidatedAsset): string {
  const domain = domainFromUrl(asset.sourceUrl);
  const domainLabel = domain ?? asset.provider;

  // Attribution explicitly required → use template or fallback
  if (asset.license.attribution.required) {
    if (asset.license.attribution.textTemplate) {
      const filled = asset.license.attribution.textTemplate.replace(
        /\{author\}/g,
        asset.recommendedAttribution ?? "Unknown"
      );
      return truncate(filled, MAX_LINE_LENGTH);
    }
    const suffix = domain ? ` (${domain})` : "";
    return truncate(`Courtesy of ${asset.provider}${suffix}`, MAX_LINE_LENGTH);
  }

  // Not required — generate informational credit by provider type
  switch (asset.provider) {
    case "unsplash":
    case "pexels":
      return truncate(`Image: ${asset.provider} (${domainLabel})`, MAX_LINE_LENGTH);
    case "pressroom":
      return truncate(`Press image: ${domainLabel} (see terms)`, MAX_LINE_LENGTH);
    case "ai-generation":
      return "Illustration: AI-generated";
    default:
      return truncate(`Image: ${asset.provider} (${domainLabel})`, MAX_LINE_LENGTH);
  }
}

function buildFooterCredits(
  images: ValidatedAsset[],
  perImageCredits: AttributionLine[],
  channel: PostChannel
): AttributionLine[] {
  const footer: AttributionLine[] = [];

  for (const credit of perImageCredits) {
    const asset = images.find((img) => img.assetId === credit.assetId);
    if (!asset) continue;

    // hero_unedited → always included
    if (asset.role === "hero_unedited") {
      footer.push(credit);
      continue;
    }

    // instagram: skip non-hero
    if (channel === "instagram") continue;

    // web/newsletter: include all
    footer.push(credit);
  }

  return footer;
}

function buildCaptionAppendix(
  perImageCredits: AttributionLine[],
  channel: PostChannel
): string {
  if (perImageCredits.length === 0) return "";

  if (channel === "instagram") {
    // Deduplicate by provider+domain for compact caption
    const seen = new Set<string>();
    const parts: string[] = [];

    for (const credit of perImageCredits) {
      const key = `${credit.provider}:${credit.text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      parts.push(credit.text);
    }

    const joined = `Credits: ${parts.join("; ")}.`;
    return truncate(joined, MAX_LINE_LENGTH * 2);
  }

  // web / newsletter: line-by-line, deduplicate by text
  const seen = new Set<string>();
  const lines: string[] = [];

  for (const credit of perImageCredits) {
    if (seen.has(credit.text)) continue;
    seen.add(credit.text);
    lines.push(`- ${credit.text}`);
  }

  return `Image credits:\n${lines.join("\n")}`;
}

export function buildAttributionBundle(input: {
  images: ValidatedAsset[];
  channel: PostChannel;
}): AttributionBundle {
  const { images, channel } = input;

  const perImageCredits: AttributionLine[] = images.map((asset) => ({
    assetId: asset.assetId,
    provider: asset.provider,
    role: asset.role,
    text: buildCreditText(asset),
  }));

  const footerCredits = buildFooterCredits(images, perImageCredits, channel);
  const captionAppendix = buildCaptionAppendix(perImageCredits, channel);

  return {
    captionAppendix,
    footerCredits,
    perImageCredits,
  };
}
