import { createHash } from "node:crypto";
import { slugifyTopic } from "./normalize.js";
import { yyyymmdd } from "./time.js";

/**
 * Generate a deterministic topic ID.
 *
 * Format: `${slug}-${YYYYMMDD}-${hash6}`
 *   - slug: slugifyTopic(normalizedTopic)
 *   - YYYYMMDD: date portion of createdAtIso
 *   - hash6: first 6 hex chars of sha256(seedKeyword + "|" + createdAtIso)
 */
export function makeTopicId(
  normalizedTopic: string,
  seedKeyword: string,
  createdAtIso: string,
): string {
  const base = slugifyTopic(normalizedTopic);
  const datePart = yyyymmdd(new Date(createdAtIso));
  const hashPart = createHash("sha256")
    .update(seedKeyword + "|" + createdAtIso)
    .digest("hex")
    .slice(0, 6);

  return `${base}-${datePart}-${hashPart}`;
}
