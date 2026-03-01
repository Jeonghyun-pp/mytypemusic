import fs from "node:fs/promises";
import { parseNormalizedArticles } from "../../schema.js";
import type { NormalizedArticle } from "./normalize.js";

/**
 * Shape of a SignalResult file produced by trend-signals agent.
 */
interface SignalResultFile {
  articles: unknown[];
  [key: string]: unknown;
}

/**
 * Load external signal articles from a signal-result.json file.
 *
 * Validates each article against NormalizedArticleSchema.
 * Returns only valid articles; logs warnings for invalid ones.
 */
export async function loadExternalArticles(
  filePath: string,
): Promise<NormalizedArticle[]> {
  const raw = await fs.readFile(filePath, "utf-8");
  const data = JSON.parse(raw) as SignalResultFile;

  if (!Array.isArray(data.articles)) {
    throw new Error(`Invalid signal result: "articles" field is not an array in ${filePath}`);
  }

  const articles = parseNormalizedArticles(data.articles);
  return articles;
}
