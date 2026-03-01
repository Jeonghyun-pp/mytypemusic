import type { TopicPackage } from "./types.js";

/**
 * Build Instagram caption text.
 *
 * Layout:
 *   1) topic.title
 *   2) topic.subtitle (if present)
 *   3) blank line
 *   4) keyFacts (up to 4, bulleted: "- <fact>")
 *   5) blank line + captionAppendix (if non-empty after trim)
 */
export function buildCaption(params: {
  topic: TopicPackage;
  captionAppendix: string;
}): string {
  const { topic, captionAppendix } = params;
  const lines: string[] = [];

  // 1) title
  lines.push(topic.title);

  // 2) subtitle
  if (topic.subtitle) {
    lines.push(topic.subtitle);
  }

  // 3) keyFacts (up to 4)
  if (topic.keyFacts && topic.keyFacts.length > 0) {
    lines.push("");
    const facts = topic.keyFacts.slice(0, 4);
    for (const fact of facts) {
      lines.push(`- ${fact}`);
    }
  }

  // 4) captionAppendix
  if (captionAppendix.trim().length > 0) {
    lines.push("");
    lines.push(captionAppendix);
  }

  return lines.join("\n");
}

const DEFAULT_CTA = "저장해두고 나중에 보기 · 팔로우로 다음 편 받기";

/**
 * Build Instagram caption for a multi-slide deck.
 *
 * Layout:
 *   1) title
 *   2) subtitle (if present)
 *   3) blank
 *   4) keyFacts top 4 bullets
 *   5) blank
 *   6) CTA line
 *   7) captionAppendix (if non-empty)
 *   8) hashtags (if any)
 */
export function buildDeckCaption(params: {
  topic: TopicPackage;
  captionAppendix: string;
  hashtags?: string[];
  cta?: string;
}): string {
  const { topic, captionAppendix } = params;
  const lines: string[] = [];

  // 1) title
  lines.push(topic.title);

  // 2) subtitle
  if (topic.subtitle) {
    lines.push(topic.subtitle);
  }

  // 3-4) keyFacts
  if (topic.keyFacts && topic.keyFacts.length > 0) {
    lines.push("");
    const facts = topic.keyFacts.slice(0, 4);
    for (const fact of facts) {
      lines.push(`- ${fact}`);
    }
  }

  // 5-6) CTA
  lines.push("");
  lines.push(params.cta ?? DEFAULT_CTA);

  // 7) captionAppendix
  if (captionAppendix.trim().length > 0) {
    lines.push("");
    lines.push(captionAppendix);
  }

  // 8) hashtags
  const tags = params.hashtags ?? topic.hashtags;
  if (tags && tags.length > 0) {
    const formatted = tags
      .map((h) => (h.startsWith("#") ? h : `#${h}`))
      .join(" ");
    lines.push("");
    lines.push(formatted);
  }

  return lines.join("\n");
}
