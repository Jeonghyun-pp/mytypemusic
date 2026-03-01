import fs from "node:fs/promises";
import path from "node:path";
import type { TopicCategory, TopicPackage } from "../types.js";

const ALLOWED_CATEGORIES: readonly TopicCategory[] = [
  "celebrity",
  "fashion",
  "music",
  "issue",
  "lifestyle",
];

/**
 * Load and validate a topic.json file.
 *
 * Validation:
 *   - title: required, non-empty after trim
 *   - category: must be one of the allowed enum values
 *   - keyFacts: if present, must be string[]
 */
export async function loadTopic(topicPath: string): Promise<TopicPackage> {
  const absPath = path.resolve(topicPath);
  const raw = await fs.readFile(absPath, "utf-8");
  const data = JSON.parse(raw) as Record<string, unknown>;

  // title
  const title =
    typeof data.title === "string" ? data.title.trim() : "";
  if (title.length === 0) {
    throw new Error("topic.json: title is required and must be non-empty");
  }

  // category
  const category = data.category as string | undefined;
  if (
    !category ||
    !ALLOWED_CATEGORIES.includes(category as TopicCategory)
  ) {
    throw new Error(
      `topic.json: category must be one of [${ALLOWED_CATEGORIES.join(", ")}], got "${String(category)}"`
    );
  }

  // keyFacts
  let keyFacts: string[] | undefined;
  if (data.keyFacts !== undefined) {
    if (
      !Array.isArray(data.keyFacts) ||
      !data.keyFacts.every((f: unknown) => typeof f === "string")
    ) {
      throw new Error("topic.json: keyFacts must be a string array");
    }
    keyFacts = data.keyFacts as string[];
  }

  return {
    title,
    subtitle:
      typeof data.subtitle === "string" ? data.subtitle : undefined,
    bodyText:
      typeof data.bodyText === "string" ? data.bodyText : undefined,
    hashtags: Array.isArray(data.hashtags)
      ? (data.hashtags as string[])
      : undefined,
    category: category as TopicCategory,
    keyFacts,
  };
}
