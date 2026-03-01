import fs from "node:fs/promises";
import path from "node:path";
import { getAngleHistoryPath } from "../../io/paths.js";

// ============================================================================
// Types
// ============================================================================

export interface AngleHistoryEntry {
  topicId: string;
  normalizedTopic: string;
  category: string;
  angles: string[];
  createdAt: string; // ISO 8601
}

interface AngleHistory {
  entries: AngleHistoryEntry[];
}

// ============================================================================
// Core
// ============================================================================

const DEFAULT_TTL_DAYS = 7;

function isWithinDays(isoDate: string, days: number): boolean {
  const ts = new Date(isoDate).getTime();
  if (isNaN(ts)) return false;
  return Date.now() - ts < days * 24 * 60 * 60 * 1000;
}

/**
 * Load angle history, pruning entries older than `ttlDays`.
 */
export async function loadHistory(ttlDays: number = DEFAULT_TTL_DAYS): Promise<AngleHistory> {
  const filePath = getAngleHistoryPath();

  let history: AngleHistory;
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    history = JSON.parse(raw) as AngleHistory;
  } catch {
    return { entries: [] };
  }

  // Prune stale entries
  history.entries = history.entries.filter((e) => isWithinDays(e.createdAt, ttlDays));

  return history;
}

/**
 * Append an entry to the history file.
 * Automatically prunes entries older than `ttlDays`.
 */
export async function appendHistory(
  entry: AngleHistoryEntry,
  ttlDays: number = DEFAULT_TTL_DAYS,
): Promise<void> {
  const history = await loadHistory(ttlDays);
  history.entries.push(entry);

  const filePath = getAngleHistoryPath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(history, null, 2) + "\n", "utf-8");
}

/**
 * Get all angles used within the last `days` days.
 */
export async function getRecentAngles(days: number = DEFAULT_TTL_DAYS): Promise<string[]> {
  const history = await loadHistory(days);
  const all: string[] = [];
  for (const entry of history.entries) {
    all.push(...entry.angles);
  }
  // Deduplicate
  return [...new Set(all)];
}

/**
 * Get recent topic titles (normalizedTopic) within the last `days` days.
 */
export async function getRecentTopics(days: number = DEFAULT_TTL_DAYS): Promise<string[]> {
  const history = await loadHistory(days);
  const topics = history.entries.map((e) => e.normalizedTopic);
  return [...new Set(topics)];
}
